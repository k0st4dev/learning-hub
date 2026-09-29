import { createServer } from 'node:http';
import next from 'next';
import { environment } from './environment.mjs';
import { allowedLocalRequest } from '../src/server/request-policy.ts';

// Public Next.js server API: keeps the local development server in one process.
const config = environment();
const application = next({
  dev: true,
  hostname: config.host,
  port: config.port,
});
await application.prepare();
const handler = application.getRequestHandler();
const upgrade = application.getUpgradeHandler();
const server = createServer((request, response) => {
  const headers = new Headers();
  for (const name of ['host', 'origin']) {
    if (typeof request.headers[name] === 'string')
      headers.set(name, request.headers[name]);
  }
  if (!allowedLocalRequest(headers, request.method ?? 'GET', config.origin)) {
    response.writeHead(403).end('Use the configured local address.');
    return;
  }
  handler(request, response);
});
server.on('upgrade', (request, socket, head) => {
  if (
    request.headers.host !== new URL(config.origin).host ||
    (request.headers.origin && request.headers.origin !== config.origin)
  ) {
    socket.destroy();
    return;
  }
  upgrade(request, socket, head);
});
server.on('error', () => {
  console.error(
    'Local development server could not listen. Check the configured port.',
  );
  process.exitCode = 1;
});
server.listen(config.port, config.host, () =>
  console.log(`Development server ready: ${config.origin}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    server.close();
    server.closeAllConnections();
    await application.close();
    process.exit(0);
  });
