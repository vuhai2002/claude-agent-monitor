'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { SubagentScanner, DEFAULT_PROJECTS_ROOT } = require('./lib/subagent-scanner');

const PORT = Number(process.env.AGENT_MONITOR_PORT || 4478);
const PROJECTS_ROOT = process.env.AGENT_MONITOR_PROJECTS_ROOT || DEFAULT_PROJECTS_ROOT;
const STALE_AFTER_MS = Number(process.env.AGENT_MONITOR_STALE_MS || 10 * 60 * 1000);
const MAX_AGE_MS = Number(process.env.AGENT_MONITOR_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const SETTLE_MS = Number(process.env.AGENT_MONITOR_SETTLE_MS || 5 * 1000);

const PUBLIC_DIR = path.join(__dirname, 'public');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
const scanner = new SubagentScanner({
  projectsRoot: PROJECTS_ROOT,
  staleAfterMs: STALE_AFTER_MS,
  maxAgeMs: MAX_AGE_MS,
  settleMs: SETTLE_MS,
});

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];

  if (route === '/api/agents') {
    sendAgents(res);
    return;
  }

  sendAsset(res, route);
});

function sendAgents(res) {
  let body;
  try {
    body = JSON.stringify({ agents: scanner.scan(), scannedAt: Date.now() });
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(error && error.message) }));
    return;
  }
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendAsset(res, route) {
  // basename discards any traversal segments before a path reaches the disk,
  // and the extension whitelist keeps this to the three files the page needs.
  const name = route === '/' || route === '/index.html'
    ? 'dashboard.html'
    : path.basename(route);
  const type = CONTENT_TYPES[path.extname(name)];

  if (!type) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  fs.readFile(path.join(PUBLIC_DIR, name), (error, body) => {
    if (error) {
      const missing = error.code === 'ENOENT';
      res.writeHead(missing ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(missing ? 'not found' : 'Không đọc được ' + name);
      return;
    }
    // No caching: the launcher serves straight off disk, so an edit shows on reload.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  });
}

/**
 * Opens the dashboard only once the port is accepting connections, so a
 * launcher never drops the browser onto a connection error.
 */
function openInBrowser(url) {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command, () => {
    /* best effort - the address is printed above either way */
  });
}

// Bound to loopback on purpose - this exposes local transcript metadata.
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  // Printed here rather than in the .bat launcher: cmd.exe cannot carry
  // Vietnamese diacritics in a batch file, but Node's UTF-8 output can.
  console.log('');
  console.log('  ===========================================');
  console.log('    Claude Subagent Monitor');
  console.log('  ===========================================');
  console.log('');
  console.log(`  Địa chỉ:  ${url}`);
  console.log('  Để dừng:  đóng cửa sổ này lại.');
  console.log('');
  console.log(`  Đang quét: ${PROJECTS_ROOT}`);
  console.log('');
  if (process.env.AGENT_MONITOR_OPEN === '1') openInBrowser(url);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} đang được dùng. Đặt AGENT_MONITOR_PORT để đổi port.`);
    process.exit(1);
  }
  throw error;
});
