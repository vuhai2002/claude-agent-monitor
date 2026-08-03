'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readLastRecord, looksFinished } = require('./transcript-tail-record');
const { TranscriptStats } = require('./transcript-stats');

const DEFAULT_PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const DEFAULT_STALE_AFTER_MS = 10 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SETTLE_MS = 5 * 1000;
// Enough of the launch prompt to see what an agent was asked for, without
// pushing every prompt in full down the wire once a second.
const PROMPT_PREVIEW_CHARS = 800;
// The busiest few tools tell the story; a long tail just crowds the card.
const TOOL_BREAKDOWN_LIMIT = 5;
const CWD_PATTERN = /"cwd":"((?:[^"\\]|\\.)*)"/;
const STATUS_ORDER = { running: 0, stale: 1, done: 2 };

/**
 * Discovers Claude Code subagents from the metadata the CLI writes beside each
 * session transcript, and works out which ones are still working.
 *
 * Layout it relies on:
 *   <projects>/<project>/<session>.jsonl                        session transcript
 *   <projects>/<project>/<session>/subagents/agent-<id>.meta.json
 *   <projects>/<project>/<session>/subagents/agent-<id>.jsonl   agent transcript
 *
 * Completion is read from the agent's own transcript, not from a tool result in
 * the spawner's transcript: an agent launched in the background receives its
 * tool result the moment it starts, so the spawner cannot say when it stopped.
 */
class SubagentScanner {
  constructor(options = {}) {
    this.projectsRoot = options.projectsRoot ?? DEFAULT_PROJECTS_ROOT;
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    this.settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
    // agentId -> { mtime, done }: a transcript tail is re-read only once the
    // file has actually changed.
    this.verdicts = new Map();
    this.labels = new Map();
    this.stats = new TranscriptStats();
  }

  scan() {
    const now = Date.now();
    const cutoff = now - this.maxAgeMs;
    const agents = [];

    for (const project of listDirectories(this.projectsRoot)) {
      const projectPath = path.join(this.projectsRoot, project);

      for (const sessionId of listDirectories(projectPath)) {
        const subagentsDir = path.join(projectPath, sessionId, 'subagents');
        const found = this.readRecentSubagents(subagentsDir, sessionId, cutoff);
        if (found.length === 0) continue;

        const sessionFile = path.join(projectPath, `${sessionId}.jsonl`);
        const projectLabel = this.projectLabel(sessionFile, project);
        for (const agent of found) {
          agents.push(this.withStatus({ ...agent, projectLabel }, now));
        }
      }
    }

    return agents.sort(compareAgents);
  }

  readRecentSubagents(subagentsDir, sessionId, cutoff) {
    const records = [];

    for (const entry of listFiles(subagentsDir)) {
      if (!entry.endsWith('.meta.json')) continue;

      const agentId = entry.slice(0, -'.meta.json'.length);
      const metaPath = path.join(subagentsDir, entry);
      const transcriptPath = path.join(subagentsDir, `${agentId}.jsonl`);

      const metaMtime = mtimeOf(metaPath);
      if (metaMtime === null) continue;
      const lastActivity = mtimeOf(transcriptPath) ?? metaMtime;
      // Older runs are history, not a live view - skip before parsing anything.
      if (lastActivity < cutoff) continue;

      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        // Half-written or corrupt - a later poll will pick it up.
        continue;
      }
      if (!meta) continue;

      records.push({
        agentId,
        transcriptPath,
        sessionId,
        agentType: meta.agentType || 'unknown',
        description: meta.description || '',
        spawnDepth: meta.spawnDepth ?? 1,
        startedAt: metaMtime,
        lastActivity,
      });
    }

    return records;
  }

  withStatus(agent, now) {
    const isDone = this.isFinished(agent, now);
    const idleMs = now - agent.lastActivity;

    let status = 'running';
    if (isDone) status = 'done';
    else if (idleMs > this.staleAfterMs) status = 'stale';

    const stats = this.stats.read(agent.agentId, agent.transcriptPath);
    const { transcriptPath, ...visible } = agent;

    return {
      ...visible,
      status,
      idleMs,
      elapsedMs: (isDone ? agent.lastActivity : now) - agent.startedAt,
      model: stats.model,
      outputTokens: stats.outputTokens,
      contextTokens: stats.contextTokens,
      cacheReadTokens: stats.cacheReadTokens,
      turns: stats.turns,
      toolCalls: stats.toolCalls,
      toolBreakdown: stats.toolBreakdown.slice(0, TOOL_BREAKDOWN_LIMIT),
      errorCount: stats.errorCount,
      gitBranch: stats.gitBranch,
      startedAtIso: stats.startedAtIso,
      // Only meaningful while an agent is mid-flight; afterwards it is just the
      // last tool it happened to reach for.
      lastTool: status === 'running' ? stats.lastTool : null,
      prompt: stats.prompt ? stats.prompt.slice(0, PROMPT_PREVIEW_CHARS) : null,
      promptTruncated: Boolean(stats.prompt && stats.prompt.length > PROMPT_PREVIEW_CHARS),
    };
  }

  isFinished(agent, now) {
    // Mid-turn a model can emit a text preamble as its own record and only add
    // the tool call a moment later, so give the transcript time to settle first.
    if (now - agent.lastActivity < this.settleMs) return false;

    const cached = this.verdicts.get(agent.agentId);
    if (cached && cached.mtime === agent.lastActivity) return cached.done;

    const done = looksFinished(readLastRecord(agent.transcriptPath));
    // Keyed on mtime, so a premature verdict is revisited the moment the agent
    // writes anything further rather than sticking for the life of the process.
    this.verdicts.set(agent.agentId, { mtime: agent.lastActivity, done });
    return done;
  }

  /** Prefers the working directory recorded in the transcript over the encoded folder name. */
  projectLabel(sessionFile, fallbackDirName) {
    if (this.labels.has(sessionFile)) return this.labels.get(sessionFile);

    let label = fallbackDirName.replace(/^[A-Za-z]--/, '');
    let fd;
    try {
      fd = fs.openSync(sessionFile, 'r');
      const buffer = Buffer.allocUnsafe(8192);
      const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
      const match = CWD_PATTERN.exec(buffer.subarray(0, bytesRead).toString('utf8'));
      if (match) label = path.basename(JSON.parse(`"${match[1]}"`));
    } catch {
      /* keep the fallback */
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          /* already closed */
        }
      }
    }

    this.labels.set(sessionFile, label);
    return label;
  }
}

function compareAgents(a, b) {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;

  // Unfinished work is ordered by start time. Ordering it by last activity
  // would reshuffle the list several times a second, because a running agent
  // rewrites its transcript continuously - the very rows being watched would
  // never hold still. Oldest first also means a newly spawned agent appears at
  // the bottom instead of displacing everything already on screen.
  if (a.status !== 'done') {
    return a.startedAt - b.startedAt || compareIds(a, b);
  }

  // A finished transcript stops changing, so last activity is stable here, and
  // most recently finished first is the useful order for a history list.
  return b.lastActivity - a.lastActivity || compareIds(a, b);
}

/** Final tiebreak, so equal timestamps still produce one fixed order. */
function compareIds(a, b) {
  return a.agentId < b.agentId ? -1 : 1;
}

function mtimeOf(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function listDirectories(dir) {
  return listEntries(dir, (entry) => entry.isDirectory());
}

function listFiles(dir) {
  return listEntries(dir, (entry) => entry.isFile());
}

function listEntries(dir, predicate) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(predicate)
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

module.exports = { SubagentScanner, DEFAULT_PROJECTS_ROOT };
