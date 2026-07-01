import { createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const secret = process.env.DEPLOY_HOOK_SECRET ?? '';
const repoRoot = process.env.REPO_ROOT ?? '/repo';
const deployScript = process.env.DEPLOY_SCRIPT ?? 'infra/deploy-quick.sh';
const port = Number(process.env.DEPLOY_HOOK_PORT ?? 5189);

let deploying = false;

function verifyAuth(authHeader) {
  if (!secret) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function runDeploy() {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [deployScript], { cwd: repoRoot, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function tail(text, max = 12000) {
  return text.length <= max ? text : `…${text.slice(-max)}`;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/hooks/healthz') {
      json(res, 200, { status: 'ok', service: 'deploy-hook', enabled: Boolean(secret), deploying });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/hooks/deploy') {
      if (!secret) {
        json(res, 503, { message: 'DEPLOY_HOOK_SECRET is not configured', code: 'deploy_disabled' });
        return;
      }
      if (!verifyAuth(req.headers.authorization)) {
        json(res, 401, { message: 'Unauthorized', code: 'unauthorized' });
        return;
      }
      if (deploying) {
        json(res, 409, { message: 'Deploy already in progress', code: 'deploy_busy' });
        return;
      }

      await readJson(req);
      deploying = true;
      const started = new Date().toISOString();
      console.log(`[deploy-hook] deploy started at ${started}`);
      try {
        const result = await runDeploy();
        const ok = result.code === 0;
        json(res, ok ? 200 : 500, {
          ok,
          started,
          finished: new Date().toISOString(),
          exit_code: result.code,
          stdout: tail(result.stdout),
          stderr: tail(result.stderr),
        });
      } finally {
        deploying = false;
      }
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  } catch (err) {
    console.error(err);
    json(res, 500, { message: 'Internal server error' });
  }
});

if (!secret) {
  console.warn('deploy-hook: DEPLOY_HOOK_SECRET is not set — POST /hooks/deploy is disabled');
}

server.listen(port, () => {
  console.log(`deploy-hook listening on http://localhost:${port}`);
});
