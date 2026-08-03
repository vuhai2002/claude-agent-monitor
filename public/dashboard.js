'use strict';

const POLL_MS = 1000;
const STATE_LABEL = { running: 'đang chạy', stale: 'không rõ', done: 'xong' };

let agents = [];
let lastError = null;
// Finished agents are collapsed by default - the page answers what is running
// now, and a day of history buries that.
let showDone = false;
// Describes the last DOM build. A poll that changes nothing structural then
// only moves the clocks, so row entry animations are not restarted each second.
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

function signatureOf(ordered) {
  return showDone + '|' + ordered.map((a) => a.agentId + ':' + a.status).join(',');
}

function rowHtml(agent, index) {
  const finished = agent.status === 'done';
  const elapsed = finished ? agent.elapsedMs : Date.now() - agent.startedAt;
  const depth = agent.spawnDepth > 1
    ? '<span class="depth">depth ' + agent.spawnDepth + '</span>'
    : '';

  return '<article class="row row-' + agent.status + '"'
    + ' style="animation-delay:' + Math.min(index, 12) * 22 + 'ms">'
    + '<span class="rail"></span>'
    + '<div class="ident">'
    + '<div class="head">'
    + '<span class="type">' + escapeHtml(agent.agentType) + '</span>'
    + depth
    + '<span class="project">' + escapeHtml(agent.projectLabel) + '</span>'
    + '</div>'
    + '<p class="desc">' + escapeHtml(agent.description || 'không có mô tả') + '</p>'
    + '</div>'
    + '<div class="timing">'
    + '<span class="elapsed" data-started="' + agent.startedAt + '"'
    + ' data-final="' + (finished ? agent.elapsedMs : '') + '">'
    + formatDuration(elapsed) + '</span>'
    + '<span class="state">' + STATE_LABEL[agent.status] + '</span>'
    + '</div>'
    + '</article>';
}

/** Advances only the running clocks, leaving the rest of the DOM untouched. */
function tickClocks() {
  const now = Date.now();
  for (const node of document.querySelectorAll('.elapsed')) {
    if (node.dataset.final) continue;
    node.textContent = formatDuration(now - Number(node.dataset.started));
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
  if (signature === builtSignature) {
    tickClocks();
    return;
  }
  builtSignature = signature;

  el.active.innerHTML = active.length
    ? active.map(rowHtml).join('')
    : '<p class="empty">'
      + (agents.length ? 'không có subagent nào đang chạy' : 'chưa ghi nhận subagent nào')
      + '</p>';

  el.toggle.hidden = done.length === 0;
  el.toggle.textContent = (showDone ? 'ẩn ' : 'hiện ') + done.length + ' đã xong';

  el.done.hidden = !showDone || done.length === 0;
  el.done.innerHTML = showDone ? done.map(rowHtml).join('') : '';
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
