import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const sdkDir = join(rootDir, '..', '..', 'Cursor', 'supadupabase', 'packages', 'sdk', 'dist');
const port = Number(process.env.TIMESHEET_PORT ?? 5180);

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
  '/styles.css': 'styles.css',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/sw.js': 'sw.js',
};

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
