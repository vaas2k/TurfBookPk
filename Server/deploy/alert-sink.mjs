import { createServer } from 'node:http';

createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/alerts') { response.writeHead(404).end(); return; }
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) request.destroy();
  });
  request.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const names = Array.isArray(payload.alerts) ? payload.alerts.map((alert) => String(alert.labels?.alertname || 'unknown').slice(0, 80)) : [];
      console.log(JSON.stringify({ event: 'alert_received', status: payload.status, names }));
      response.writeHead(200).end('ok');
    } catch { response.writeHead(400).end(); }
  });
}).listen(9099);
