'use strict';

const POLL_MS = 1000;
const STATE_LABEL = { running: 'đang chạy', stale: 'không rõ', done: 'xong' };

let agents = [];
let lastError = null;
// Finished agents are collapsed by default - the page answers what is running
// now, and a day of history buries that.
let showDone = false;
// Describes the last DOM build. A poll that changes nothing structural then
// only moves the clocks, which also keeps open prompt panels from snapping shut.
let builtSignature = '';

const el = {
  mark: document.getElementById('mark'),
  readout: document.getElementById('readout'),
  active: document.getElementById('active-list'),
  done: document.getElementById('done-list'),
  toggle: document.getElementById('toggle'),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
  ));
}

function formatDuration(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const seconds = Math.floor(safe / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
  return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}

function formatCount(value) {
  if (!Number.isFinite(value)) return '-';
  if (value < 1000) return String(value);
  if (value < 1000000) return (value / 1000).toFixed(value < 10000 ? 1 : 0) + 'k';
  return (value / 1000000).toFixed(1) + 'M';
}

// Only membership and status force a rebuild. Everything that moves while an
// agent works - clock, tokens, tool count, current tool - is written into the
// existing cells instead, so a card is never torn down under the reader and an
// open prompt panel stays open.
function signatureOf(ordered) {
  return showDone + '|' + ordered.map((a) => a.agentId + ':' + a.status).join(',');
}

const METRICS = [
  ['elapsed', 'thời gian'],
  ['output', 'token ra'],
  ['tools', 'tool'],
  ['turns', 'lượt'],
];

function chipsHtml(agent) {
  const model = agent.model
    ? '<span class="chip chip-model">' + escapeHtml(agent.model) + '</span>'
    : '';
  // Rendered even when idle, so the live pass can fill it in without a rebuild.
  const tool = '<span class="chip chip-tool" data-role="tool"'
    + (agent.lastTool ? '' : ' hidden') + '>'
    + escapeHtml(agent.lastTool || '') + '</span>';

  return model
    + '<span class="chip chip-state">' + STATE_LABEL[agent.status] + '</span>'
    + tool;
}

function metricsHtml() {
  return METRICS
    .map(([key, label]) => '<div><dt>' + label + '</dt><dd data-metric="' + key + '">-</dd></div>')
    .join('');
}

function metricValues(agent, now) {
  const finished = agent.status === 'done';
  return {
    elapsed: formatDuration(finished ? agent.elapsedMs : now - agent.startedAt),
    output: formatCount(agent.outputTokens),
    tools: formatCount(agent.toolCalls),
    turns: formatCount(agent.turns),
  };
}

function promptHtml(agent) {
  if (!agent.prompt) return '';
  const body = escapeHtml(agent.prompt) + (agent.promptTruncated ? '\n\n[...]' : '');
  return '<details class="prompt"><summary>prompt gọi agent</summary><pre>' + body + '</pre></details>';
}

function cardHtml(agent) {
  const depth = agent.spawnDepth > 1
    ? '<span class="depth">depth ' + agent.spawnDepth + '</span>'
    : '';

  return '<article class="card card-' + agent.status + '"'
    + ' data-agent="' + escapeHtml(agent.agentId) + '">'
    + '<header class="card-head">'
    + '<span class="dot"></span>'
    + '<span class="who">'
    + '<span class="type">' + escapeHtml(agent.agentType) + '</span>'
    + '<span class="project">' + escapeHtml(agent.projectLabel) + '</span>'
    + '</span>'
    + depth
    + '</header>'
    + '<p class="task">' + escapeHtml(agent.description || 'không có mô tả') + '</p>'
    + '<div class="chips">' + chipsHtml(agent) + '</div>'
    + '<dl class="metrics">' + metricsHtml() + '</dl>'
    + promptHtml(agent)
    + '</article>';
}

/** Writes live figures into cards that already exist, rebuilding nothing. */
function refreshCards() {
  const now = Date.now();

  for (const agent of agents) {
    const card = document.querySelector('[data-agent="' + agent.agentId + '"]');
    if (!card) continue;

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
  }
}

function updateReadout(active) {
  if (lastError) {
    el.mark.classList.remove('is-live');
    el.readout.textContent = 'mất kết nối - kiểm tra cửa sổ terminal còn mở không';
    return;
  }

  const running = active.filter((agent) => agent.status === 'running').length;
  el.mark.classList.toggle('is-live', running > 0);
  el.readout.innerHTML = '<b class="' + (running ? 'is-live' : '') + '">' + running + '</b>'
    + ' đang chạy &middot; <b>' + agents.length + '</b> tổng';
}

function render() {
  // "stale" is unfinished work that went quiet, so it stays alongside running -
  // a stuck agent is exactly what someone watching this page wants to notice.
  const active = agents.filter((agent) => agent.status !== 'done');
  const done = agents.filter((agent) => agent.status === 'done');

  updateReadout(active);

  const signature = signatureOf(active.concat(done));
  if (signature !== builtSignature) {
    builtSignature = signature;

    el.active.innerHTML = active.length
      ? active.map(cardHtml).join('')
      : '<p class="empty">'
        + (agents.length ? 'không có subagent nào đang chạy' : 'chưa ghi nhận subagent nào')
        + '</p>';

    el.toggle.hidden = done.length === 0;
    el.toggle.textContent = (showDone ? 'ẩn ' : 'hiện ') + done.length + ' đã xong';

    el.done.hidden = !showDone || done.length === 0;
    el.done.innerHTML = showDone ? done.map(cardHtml).join('') : '';
  }

  // Runs after both paths: a fresh card is built with placeholder figures.
  refreshCards();
}

async function poll() {
  try {
    const response = await fetch('/api/agents');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    agents = Array.isArray(data.agents) ? data.agents : [];
    lastError = null;
  } catch (error) {
    lastError = error.message;
  }
  render();
}

el.toggle.addEventListener('click', () => {
  showDone = !showDone;
  render();
});

poll();
setInterval(poll, POLL_MS);
