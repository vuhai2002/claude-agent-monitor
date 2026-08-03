'use strict';

const fs = require('fs');

/**
 * Accumulates per-agent figures from a transcript: model, token usage, tool
 * calls, turns, and the task prompt the agent was launched with.
 *
 * Each agent's file is read incrementally from a byte offset, so a poll only
 * pays for whatever the agent appended since the previous one.
 *
 * Two details of the transcript format drive the shape of this code:
 *
 *  - A single model turn is written as several records as it streams (thinking,
 *    then text, then a tool call), all carrying the same message id and a usage
 *    block that grows with each rewrite. Usage is therefore kept per message id
 *    and overwritten, never added up, or the totals inflate several times over.
 *
 *  - Token figures here are derived from the transcript alone. They do not
 *    reproduce the subagent_tokens number Claude Code reports when a task
 *    finishes; that aggregation was compared against six known runs and no
 *    consistent relationship was found, so it is not guessed at.
 */
class TranscriptStats {
  constructor() {
    this.byAgent = new Map();
  }

  /** Returns the current figures for an agent, reading only what is new. */
  read(agentId, transcriptPath) {
    let state = this.byAgent.get(agentId);
    if (!state) {
      state = {
        offset: 0,
        usageByMessage: new Map(),
        toolCallIds: new Set(),
        toolCounts: new Map(),
        erroredToolIds: new Set(),
        model: null,
        lastTool: null,
        prompt: null,
        startedAtIso: null,
        gitBranch: null,
      };
      this.byAgent.set(agentId, state);
    }

    const chunk = readFrom(transcriptPath, state);
    if (chunk) {
      for (const line of chunk.split('\n')) {
        if (line.trim()) absorb(state, line);
      }
    }

    return summarise(state);
  }

  forget(agentId) {
    this.byAgent.delete(agentId);
  }
}

/** Reads appended bytes, stopping at the last complete line. */
function readFrom(filePath, state) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return '';
  }

  // A file that shrank was replaced, so every derived figure is stale too.
  if (stat.size < state.offset) {
    state.offset = 0;
    state.usageByMessage.clear();
    state.toolCallIds.clear();
    state.toolCounts.clear();
    state.erroredToolIds.clear();
  }
  if (stat.size <= state.offset) return '';

  let buffer;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const length = stat.size - state.offset;
    buffer = Buffer.allocUnsafe(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, state.offset);
    buffer = buffer.subarray(0, bytesRead);
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* already closed */
      }
    }
  }

  // Leave a trailing partial line unconsumed; the next poll re-reads it whole.
  const lastNewline = buffer.lastIndexOf(0x0a);
  if (lastNewline === -1) return '';

  state.offset += lastNewline + 1;
  return buffer.subarray(0, lastNewline + 1).toString('utf8');
}

function absorb(state, line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return;
  }

  if (state.startedAtIso === null && record.timestamp) state.startedAtIso = record.timestamp;
  if (state.gitBranch === null && record.gitBranch) state.gitBranch = record.gitBranch;

  const message = record.message;
  if (!message) return;

  if (record.type === 'user') {
    // The opening user record carries the prompt the agent was launched with.
    if (state.prompt === null && typeof message.content === 'string') state.prompt = message.content;

    // Later ones carry tool results, including the failures.
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block && block.type === 'tool_result' && block.is_error) {
        state.erroredToolIds.add(block.tool_use_id);
      }
    }
    return;
  }

  if (record.type !== 'assistant') return;

  if (message.model) state.model = message.model;
  if (message.usage && message.id) state.usageByMessage.set(message.id, message.usage);

  for (const block of Array.isArray(message.content) ? message.content : []) {
    if (!block || block.type !== 'tool_use') continue;

    // A streaming turn repeats its tool_use block across records, so the
    // per-tool tally only moves the first time an id is seen.
    if (!state.toolCallIds.has(block.id)) {
      state.toolCallIds.add(block.id);
      const name = block.name || 'unknown';
      state.toolCounts.set(name, (state.toolCounts.get(name) || 0) + 1);
    }
    state.lastTool = block.name || state.lastTool;
  }
}

function summarise(state) {
  let outputTokens = 0;
  let contextTokens = 0;
  let cacheReadTokens = 0;

  for (const usage of state.usageByMessage.values()) {
    outputTokens += usage.output_tokens || 0;
    // New tokens the model had to take in, ignoring what was served from cache.
    contextTokens += (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    cacheReadTokens += usage.cache_read_input_tokens || 0;
  }

  return {
    model: prettyModel(state.model),
    modelId: state.model,
    outputTokens,
    contextTokens,
    cacheReadTokens,
    turns: state.usageByMessage.size,
    toolCalls: state.toolCallIds.size,
    toolBreakdown: [...state.toolCounts.entries()].sort((a, b) => b[1] - a[1]),
    errorCount: state.erroredToolIds.size,
    lastTool: state.lastTool,
    prompt: state.prompt,
    startedAtIso: state.startedAtIso,
    gitBranch: state.gitBranch,
  };
}

/** claude-haiku-4-5-20251001 -> Haiku 4.5 */
function prettyModel(modelId) {
  if (!modelId) return null;
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(modelId);
  if (!match) return modelId;
  const family = match[1][0].toUpperCase() + match[1].slice(1);
  return family + ' ' + match[2] + (match[3] ? '.' + match[3] : '');
}

module.exports = { TranscriptStats, prettyModel };
