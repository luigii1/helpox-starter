// Command center server for helpox-starter.
// Zero dependencies. Read-only. Binds to 127.0.0.1 only.
// Usage: node center/serve.mjs   →   http://localhost:4400

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CENTER_PORT) || 4400;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inspectionsDir = join(root, 'docs', 'inspections');

// The only things this server will ever send. No user-controlled paths.
async function buildMap() {
  return readFile(join(root, 'docs', 'build-map.json'), 'utf8');
}

async function inspections() {
  let names = [];
  try {
    names = await readdir(inspectionsDir);
  } catch {
    return '[]';
  }
  const reports = [];
  for (const name of names) {
    if (!/^[A-Z][0-9]+\.json$/.test(name)) continue;
    try {
      reports.push(JSON.parse(await readFile(join(inspectionsDir, name), 'utf8')));
    } catch {
      reports.push({ brick: name.replace('.json', ''), result: 'fail', summary_fi: 'Raportti on rikki eikä sitä voi lukea.', checks: [] });
    }
  }
  return JSON.stringify(reports);
}

const routes = {
  '/': async () => ['text/html; charset=utf-8', await readFile(join(root, 'center', 'index.html'), 'utf8')],
  '/docs/build-map.json': async () => ['application/json; charset=utf-8', await buildMap()],
  '/api/inspections': async () => ['application/json; charset=utf-8', await inspections()],
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const route = req.method === 'GET' ? routes[path] : undefined;
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  try {
    const [type, body] = await route();
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    }).end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end('Could not read ' + path);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Command center: http://localhost:${PORT}`);
});
