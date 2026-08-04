/*
 * Builds one agent card and keeps its live figures up to date.
 *
 * The markup is written once. Everything that moves while an agent works is
 * then written into the cells that already exist, so a card is never torn down
 * under the reader and an open prompt panel stays open.
 */

import { agentAvatar } from './agent-avatar.js';
import { agentIcon } from './agent-icon.js';
import { escapeHtml, formatClock, formatCount, formatDuration } from './format.js';
import { icon } from './icons.js';

// "hoàn thành" rather than "thành công": the transcript says an agent stopped
// on its own, which is not the same as knowing its answer was any good.
const STATE = {
  running: { label: 'đang chạy', glyph: '' },
  stale: { label: 'không rõ', glyph: 'alert' },
  done: { label: 'hoàn thành', glyph: 'check' },
};

const METRICS = [
  ['elapsed', 'thời gian'],
  ['input', 'token vào'],
  ['output', 'token ra'],
  ['cache', 'cache'],
  ['tools', 'tool'],
  ['turns', 'lượt'],
];

export function cardHtml(agent) {
  const depth = agent.spawnDepth > 1
    ? '<span class="depth">depth ' + agent.spawnDepth + '</span>'
    : '';

  return '<article class="card card-' + agent.status + '"'
    + ' data-agent="' + escapeHtml(agent.agentId) + '">'
    + '<header class="card-head">'
    + '<span class="avatar">'
    + agentAvatar(agent.agentType)
    // The portrait says which agent; the badge says what kind of work it does.
    + '<span class="avatar-badge" aria-hidden="true">' + agentIcon(agent.agentType) + '</span>'
    + '</span>'
    + '<span class="who">'
    + '<span class="type">' + escapeHtml(agent.agentType) + '</span>'
    + '<span class="origin">' + originHtml(agent) + '</span>'
    + '</span>'
    + depth
    + '</header>'
    + '<div class="chips">' + chipsHtml(agent) + '</div>'
    + '<p class="task">' + escapeHtml(agent.description || 'không có mô tả') + '</p>'
    + '<dl class="metrics">' + metricsHtml() + '</dl>'
    + '<div class="card-foot">'
    + '<p class="breakdown" data-role="breakdown">' + icon('wrench', 12) + '<span></span></p>'
    + promptHtml(agent)
    + '</div>'
    + '</article>';
}

/** Writes the figures that change as an agent works into an existing card. */
export function refreshCard(card, agent, now) {
  const values = metricValues(agent, now);
  for (const [key] of METRICS) {
    const cell = card.querySelector('[data-metric="' + key + '"]');
    if (cell && cell.textContent !== values[key]) cell.textContent = values[key];
  }

  const tool = card.querySelector('[data-role="tool"]');
  if (tool) {
    tool.hidden = !agent.lastTool;
    if (agent.lastTool && tool.textContent !== agent.lastTool) tool.textContent = agent.lastTool;
  }

  const errors = card.querySelector('[data-role="errors"]');
  if (errors) {
    errors.hidden = !agent.errorCount;
    const label = agent.errorCount + ' lỗi';
    const slot = errors.querySelector('span');
    if (agent.errorCount && slot && slot.textContent !== label) slot.textContent = label;
  }

  const breakdown = card.querySelector('[data-role="breakdown"]');
  if (breakdown) {
    const text = breakdownText(agent);
    breakdown.hidden = !text;
    const slot = breakdown.querySelector('span');
    if (slot && slot.textContent !== text) slot.textContent = text;
  }
}

function originHtml(agent) {
  const parts = ['<span>' + escapeHtml(agent.projectLabel) + '</span>'];

  if (agent.gitBranch) {
    parts.push('<span class="branch">' + icon('branch', 12)
      + escapeHtml(agent.gitBranch) + '</span>');
  }

  const clock = formatClock(agent.startedAtIso);
  if (clock) parts.push('<span class="clock">' + clock + '</span>');

  return parts.join('<span class="sep">·</span>');
}

function chipsHtml(agent) {
  const state = STATE[agent.status];
  const model = agent.model
    ? '<span class="chip chip-model">' + escapeHtml(agent.model) + '</span>'
    : '';

  // The tool and error chips are rendered even when empty, so the live pass can
  // fill them in without rebuilding the card.
  return model
    + '<span class="chip chip-state">'
    + (state.glyph ? icon(state.glyph, 12) : '') + state.label + '</span>'
    + '<span class="chip chip-tool" data-role="tool" hidden></span>'
    + '<span class="chip chip-error" data-role="errors" hidden>'
    + icon('alert', 12) + '<span></span></span>';
}

function metricsHtml() {
  return METRICS
    .map(([key, label]) => '<div><dt>' + label + '</dt><dd data-metric="' + key + '">-</dd></div>')
    .join('');
}

function metricValues(agent, now) {
  // A running clock is recomputed here so it moves between polls rather than
  // once a second in steps. Anything that stopped keeps the figure the server
  // froze for it - recomputing that would restart the count from its start
  // time and show a stopped agent as if it were still going.
  const elapsed = agent.status === 'running' ? now - agent.startedAt : agent.elapsedMs;

  return {
    elapsed: formatDuration(elapsed),
    input: formatCount(agent.contextTokens),
    output: formatCount(agent.outputTokens),
    cache: formatCount(agent.cacheReadTokens),
    tools: formatCount(agent.toolCalls),
    turns: formatCount(agent.turns),
  };
}

function breakdownText(agent) {
  if (!Array.isArray(agent.toolBreakdown) || agent.toolBreakdown.length === 0) return '';
  return agent.toolBreakdown.map(([name, count]) => name + ' ' + count).join('  ·  ');
}

function promptHtml(agent) {
  if (!agent.prompt) return '';
  const body = escapeHtml(agent.prompt) + (agent.promptTruncated ? '\n\n[...]' : '');
  return '<details class="prompt">'
    + '<summary>' + icon('plus', 13) + 'prompt gọi agent</summary>'
    + '<pre>' + body + '</pre></details>';
}
