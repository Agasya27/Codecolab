import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.COLLAB_RELAY_PORT || 8787);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/collab' });

wss.on('connection', (socket) => {
  console.log('[relay] client connected, total:', wss.clients.size);
  socket.on('message', (raw) => {
    const payload = String(raw);
    try {
      const msg = JSON.parse(payload);
      const body = msg?.payload ?? msg?.data ?? msg;
      console.log(
        '[relay] msg',
        `type=${body?.type ?? 'unknown'}`,
        `file=${body?.fileId ?? body?.roomId ?? '-'}`,
        `user=${String(body?.userId ?? '-').slice(0, 8)}`,
        `tab=${String(body?.tabId ?? body?.connectionId ?? '-').slice(0, 8)}`,
        `bytes=${payload.length}`,
      );
    } catch {
      console.log('[relay] message bytes:', payload.length);
    }

    for (const client of wss.clients) {
      if (client === socket) continue;
      if (client.readyState !== 1) continue;
      client.send(payload);
    }
  });

  socket.on('close', () => {
    console.log('[relay] client disconnected, total:', wss.clients.size - 1);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Collab relay listening on ws://0.0.0.0:${PORT}/collab`);
});
