import { createServer as createHttpServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function isPublicPath(path) {
  return path.split(/[\\/]/).every((part) => !part.startsWith('.'));
}

function isWithin(root, file) {
  const remainder = relative(root, file);
  return remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}

/** A local static server. Saved worlds and dotfiles are never public assets. */
export function createServer({ root = PROJECT_ROOT } = {}) {
  const rootPromise = realpath(root);
  return createHttpServer(async (request, response) => {
    const send = (status, message, headers = {}) => {
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
      });
      response.end(request.method === 'HEAD' ? undefined : message);
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    try {
      // Read the raw path: URL normalization would hide incoming ../ segments.
      const requestPath = decodeURIComponent((request.url || '/').split(/[?#]/, 1)[0]);
      if (!requestPath.startsWith('/') || requestPath.includes('\\') || requestPath.includes('\0') || !isPublicPath(requestPath)) {
        send(404, 'Not found');
        return;
      }
      const publicPath = requestPath === '/' ? '/index.html' : requestPath;
      const mime = MIME_TYPES.get(extname(publicPath).toLowerCase());
      if (!mime) {
        send(404, 'Not found');
        return;
      }

      const canonicalRoot = await rootPromise;
      const file = await realpath(resolve(canonicalRoot, `.${publicPath}`));
      const canonicalRelative = relative(canonicalRoot, file);
      if (!isWithin(canonicalRoot, file) || !isPublicPath(canonicalRelative) || !MIME_TYPES.has(extname(file).toLowerCase())) {
        send(404, 'Not found');
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) {
        send(404, 'Not found');
        return;
      }
      const bytes = request.method === 'HEAD' ? undefined : await readFile(file);
      response.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': bytes?.length ?? info.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(bytes);
    } catch (error) {
      send(error instanceof URIError ? 400 : 404, error instanceof URIError ? 'Invalid URL' : 'Not found');
    }
  });
}

export function parsePort(args, environmentPort = process.env.PORT) {
  let candidate = environmentPort ?? '4173';
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--port') {
      candidate = args[++index];
    } else if (args[index].startsWith('--port=')) {
      candidate = args[index].slice(7);
    } else {
      throw new Error(`Unknown option: ${args[index]}. Usage: node server.mjs [--port 4173]`);
    }
  }
  if (typeof candidate !== 'string' || !/^\d+$/.test(candidate) || Number(candidate) < 1 || Number(candidate) > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }
  return Number(candidate);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const port = parsePort(process.argv.slice(2));
    const server = createServer();
    server.on('error', (error) => {
      console.error(`Could not start Common Ground: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Common Ground is running at http://127.0.0.1:${port}`);
      console.log('Keep this terminal open. Press Ctrl+C to stop the server.');
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
