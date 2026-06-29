import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const sdkDir = process.env.SDK_DIR ?? join(rootDir, 'sdk');
const port = Number(process.env.TIMESHEET_PORT ?? 5180);

const proxyEnabled =
  process.env.SDB_PROXY !== '0' && process.env.SDB_PROXY !== 'false';

const authUpstream = (process.env.SDB_AUTH_UPSTREAM ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const dataUpstream = (process.env.SDB_DATA_UPSTREAM ?? 'http://127.0.0.1:3002').replace(/\/$/, '');
const mailUpstream = (process.env.SDB_MAIL_UPSTREAM ?? 'http://127.0.0.1:3004').replace(/\/$/, '');

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const staticFiles: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/hours.js': 'hours.js',
  '/reminders.js': 'reminders.js',
  '/styles.css': 'styles.css',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/sw.js': 'sw.js',
  '/config.js': 'config.js',
};

function proxyUpstream(pathname: string): string | null {
  if (!proxyEnabled) return null;
  if (pathname.startsWith('/auth/')) return authUpstream;
  if (pathname.startsWith('/rest/')) return dataUpstream;
  if (pathname.startsWith('/mail/')) return mailUpstream;
  return null;
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) return undefined;
  return Buffer.concat(chunks);
}

async function proxyRequest(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const upstream = proxyUpstream(url.pathname);
  if (!upstream) return false;

  const targetUrl = `${upstream}${url.pathname}${url.search}`;
  const skipHeaders = new Set([
    'host',
    'connection',
    'expect',
    'keep-alive',
    'transfer-encoding',
  ]);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || skipHeaders.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const body = await readBody(req);
  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
  });

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
}

async function resolveFile(pathname: string): Promise<{ filePath: string; contentType: string } | null> {
  const rel = staticFiles[pathname];
  if (rel) {
    const ext = extname(rel);
    return { filePath: join(rootDir, rel), contentType: mime[ext] ?? 'application/octet-stream' };
  }
  if (pathname.startsWith('/sdk/')) {
    const sdkRel = pathname.slice(5);
    const filePath = join(sdkDir, sdkRel);
    const ext = extname(filePath);
    return { filePath, contentType: mime[ext] ?? 'text/javascript; charset=utf-8' };
  }
  if (pathname.startsWith('/lib/')) {
    const libRel = pathname.slice(5);
    const filePath = join(rootDir, 'lib', libRel);
    const ext = extname(filePath);
    return { filePath, contentType: mime[ext] ?? 'text/javascript; charset=utf-8' };
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = normalize(url.pathname);
    if (pathname.includes('..')) {
      res.statusCode = 400;
      res.end('Bad request');
      return;
    }

    if (await proxyRequest(req, res, url)) return;

    const resolved = await resolveFile(pathname);
    if (!resolved) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const content = await readFile(resolved.filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', resolved.contentType);
    res.end(content);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal server error');
  }
});

server.listen(port, () => {
  console.log(`Timesheet App at http://localhost:${port}`);
});
