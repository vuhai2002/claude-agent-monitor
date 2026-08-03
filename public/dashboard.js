import { cardHtml, refreshCard } from './agent-card.js';
import { icon, idleFigure } from './icons.js';

const POLL_MS = 1000;

let agents = [];
let lastError = null;
// Finished agents are collapsed by default - the page answers what is running
// now, and a day of history buries that.
let showDone = false;
// Describes the last DOM build. Only membership and status force a rebuild;
// everything that moves while an agent works is written into the existing
// cells instead.
let builtSignature = '';

const el = {
  logo: document.getElementById('logo'),
  totalIco: document.getElementById('total-ico'),
  mark: document.getElementById('mark'),
  countRunning: document.getElementById('count-running'),
  countTotal: document.getElementById('count-total'),
  alert: document.getElementById('alert'),
  idle: document.getElementById('idle'),
  idleFigure: document.getElementById('idle-figure'),
  idleTitle: document.getElementById('idle-title'),
  idleNote: document.getElementById('idle-note'),
  active: document.getElementById('active-list'),
  done: document.getElementById('done-list'),
  toggle: document.getElementById('toggle'),
};

function paintChrome() {
  el.logo.innerHTML = icon('pulse', 20);
  el.totalIco.innerHTML = icon('layers', 15);
  el.idleFigure.innerHTML = idleFigure();
}

function signatureOf(ordered) {
  return showDone + '|' + ordered.map((a) => a.agentId + ':' + a.status).join(',');
}

function refreshAll() {
  const now = Date.now();
  for (const agent of agents) {
    const card = document.querySelector('[data-agent="' + agent.agentId + '"]');
    if (card) refreshCard(card, agent, now);
  }
}

function updateHeader(active) {
  el.alert.hidden = !lastError;
  if (lastError) el.alert.textContent = 'Mất kết nối tới server. Kiểm tra cửa sổ terminal còn mở không.';

  const running = active.filter((agent) => agent.status === 'running').length;
  el.mark.classList.toggle('is-live', running > 0 && !lastError);
  el.countRunning.textContent = running;
  el.countTotal.textContent = agents.length;
}

function updateIdle(activeCount) {
  el.idle.hidden = activeCount > 0;
  if (activeCount > 0) return;

  const anyHistory = agents.length > 0;
  el.idleTitle.textContent = anyHistory
    ? 'không có subagent nào đang chạy'
    : 'chưa ghi nhận subagent nào';
  el.idleNote.textContent = anyHistory
    ? 'Tất cả subagent hiện tại đều đã hoàn thành.'
    : 'Chạy một subagent trong Claude Code rồi quay lại đây.';
}

function updateToggle(doneCount) {
  el.toggle.hidden = doneCount === 0;
  el.toggle.innerHTML = showDone
    ? icon('eyeOff', 15) + 'Ẩn ' + doneCount + ' đã xong'
      + '<span class="ico-end">' + icon('close', 14) + '</span>'
    : icon('eye', 15) + 'Hiện ' + doneCount + ' đã xong';
}

function render() {
  // "stale" is unfinished work that went quiet, so it stays alongside running -
  // a stuck agent is exactly what someone watching this page wants to notice.
  const active = agents.filter((agent) => agent.status !== 'done');
  const done = agents.filter((agent) => agent.status === 'done');

  updateHeader(active);
  updateIdle(active.length);

  const signature = signatureOf(active.concat(done));
  if (signature !== builtSignature) {
    builtSignature = signature;

    el.active.innerHTML = active.map(cardHtml).join('');
    updateToggle(done.length);

    el.done.hidden = !showDone || done.length === 0;
    el.done.innerHTML = showDone ? done.map(cardHtml).join('') : '';
  }

  // Runs after both paths: a fresh card is built with placeholder figures.
  refreshAll();
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

paintChrome();
poll();
setInterval(poll, POLL_MS);
