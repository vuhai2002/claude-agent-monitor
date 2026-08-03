'use strict';

const fs = require('fs');

const DEFAULT_TAIL_BYTES = 256 * 1024;

/**
 * Reads the last complete JSON record from a JSONL transcript.
 *
 * Only the tail of the file is touched, so this stays cheap on the
 * multi-megabyte transcripts Claude Code produces. Returns null when nothing
 * parseable is found.
 */
function readLastRecord(filePath, tailBytes = DEFAULT_TAIL_BYTES) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return null;
  }
  if (stat.size === 0) return null;

  const span = Math.min(stat.size, tailBytes);
  let text;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.allocUnsafe(span);
    const bytesRead = fs.readSync(fd, buffer, 0, span, stat.size - span);
    text = buffer.subarray(0, bytesRead).toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* already closed */
      }
    }
  }

  // Walk backwards: the final line may be a partial write, and starting from a
  // byte offset can slice the first line in half.
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      return JSON.parse(line);
    } catch {
      /* truncated line - keep walking back */
    }
  }

  return null;
}

/**
 * True when the transcript's final record looks like an agent's closing answer:
 * an assistant turn carrying text and asking for no further tool call.
 *
 * While an agent works, the last record is a tool result, a thinking-only turn,
 * or a turn holding a tool_use - all of which fail this test.
 *
 * Deliberately ignores stop_reason: closing records were observed carrying both
 * "end_turn" and null, so it cannot be used to tell the two states apart.
 *
 * This is necessary but not sufficient on its own. Mid-run, a model can emit a
 * short text preamble as its own record and only follow it with the tool call a
 * moment later, so callers must also require the transcript to have settled.
 */
function looksFinished(record) {
  if (!record || record.type !== 'assistant') return false;

  const message = record.message;
  if (!message) return false;

  const content = Array.isArray(message.content) ? message.content : [];
  const hasText = content.some((block) => block && block.type === 'text');
  const hasToolUse = content.some((block) => block && block.type === 'tool_use');
  return hasText && !hasToolUse;
}

module.exports = { readLastRecord, looksFinished };
