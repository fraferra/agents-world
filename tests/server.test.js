import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, parsePort } from '../server.mjs';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'common-ground-server-'));
  const root = join(base, 'public');
  await mkdir(root);
  await mkdir(join(root, '.private'));
  await Promise.all([
    writeFile(join(root, 'index.html'), '<h1>Common Ground</h1>'),
    writeFile(join(root, 'app.js'), 'export const hello = true;'),
    writeFile(join(root, '.env'), 'SECRET=private'),
    writeFile(join(root, 'world.json'), '{"private":"world"}'),
    writeFile(join(root, '.private', 'secret.js'), 'private data'),
    writeFile(join(base, 'outside.js'), 'outside data'),
  ]);
  await symlink(join(base, 'outside.js'), join(root, 'outside.js'));
  await symlink(join(root, '.env'), join(root, 'secret.js'));
  const server = createServer({ root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(base, { recursive: true, force: true });
  });
  return (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the app and ES modules with correct types, including HEAD', async (t) => {
  const get = await fixture(t);
  const home = await get('/?session=1');
  assert.equal(home.status, 200);
  assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(home.body, /Common Ground/);
  const script = await get('/app.js');
  assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(script.headers['x-content-type-options'], 'nosniff');
  const head = await get('/app.js', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(Number(head.headers['content-length']), Buffer.byteLength(script.body));
});

test('rejects dotfiles, saved worlds, traversal, and escaping symlinks', async (t) => {
  const get = await fixture(t);
  for (const path of ['/.env', '/%2eenv', '/.private/secret.js', '/../outside.js', '/%2e%2e/outside.js', '/%2e%2e%2foutside.js', '/outside.js', '/secret.js', '/world.json', '/missing.js', '/app.js%00', '/..%5coutside.js']) {
    const result = await get(path);
    assert.equal(result.status, 404, path);
    assert.equal(result.body, 'Not found', path);
  }
  assert.equal((await get('/%zz')).status, 400);
  const post = await get('/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('supports explicit ports and rejects invalid startup arguments', () => {
  assert.equal(parsePort([], undefined), 4173);
  assert.equal(parsePort([], '4567'), 4567);
  assert.equal(parsePort(['--port', '5678'], '4567'), 5678);
  assert.equal(parsePort(['--port=6789'], undefined), 6789);
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', '3.5'], ['--port', 'hello'], ['--host', '0.0.0.0']]) {
    assert.throws(() => parsePort(args, undefined));
  }
});
