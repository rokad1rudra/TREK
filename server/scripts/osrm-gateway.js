/**
 * TREK Multi-Zone OSRM Gateway with Live Request Logging & Web Dashboard
 *
 * Listens on Port 5000 and routes incoming OSRM requests (from local app or
 * Cloudflare Tunnel) to the appropriate zone container among all 6 India OSRM zones:
 *
 *   1. North     (Port 5001) - Delhi, Punjab, Haryana, HP, J&K, UP, Rajasthan
 *   2. West      (Port 5002) - Gujarat, Maharashtra, Goa
 *   3. East      (Port 5003) - WB, Bihar, Jharkhand, Odisha
 *   4. Central   (Port 5004) - MP, Chhattisgarh
 *   5. Northeast (Port 5005) - Assam, Meghalaya, Arunachal, Sikkim, etc.
 *   6. South     (Port 5006) - Karnataka, Tamil Nadu, Kerala, AP, Telangana
 *
 * Features:
 *   - Real-time console logs for every incoming request
 *   - Persistent file log in server/data/logs/osrm-gateway.log
 *   - Live Web Dashboard on http://localhost:5000/ (or /dashboard)
 *   - JSON Health API on http://localhost:5000/health
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const GATEWAY_PORT = Number(process.env.OSRM_GATEWAY_PORT || 5000);
const LOGS_DIR = path.resolve(__dirname, '../data/logs');
const LOG_FILE = path.join(LOGS_DIR, 'osrm-gateway.log');

if (!fs.existsSync(LOGS_DIR)) {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch { /* ignore */ }
}

const ZONES = [
  {
    name: 'north',
    label: 'North India (DL/PB/HR/UP/RJ/UK/HP/JK)',
    shortLabel: 'North (5001)',
    ports: [5001],
    bbox: { minLat: 24.0, maxLat: 37.5, minLng: 73.0, maxLng: 84.5 },
  },
  {
    name: 'west',
    label: 'West India (GJ/MH/GA)',
    shortLabel: 'West (5002)',
    ports: [5002],
    bbox: { minLat: 14.5, maxLat: 26.5, minLng: 68.0, maxLng: 78.5 },
  },
  {
    name: 'east',
    label: 'East India (WB/BR/JH/OD)',
    shortLabel: 'East (5003)',
    ports: [5003],
    bbox: { minLat: 18.0, maxLat: 28.0, minLng: 82.0, maxLng: 90.0 },
  },
  {
    name: 'central',
    label: 'Central India (MP/CG)',
    shortLabel: 'Central (5004)',
    ports: [5004],
    bbox: { minLat: 17.5, maxLat: 27.0, minLng: 74.5, maxLng: 84.5 },
  },
  {
    name: 'northeast',
    label: 'Northeast India (AS/ML/AR/NL/MN/MZ/TR/SK)',
    shortLabel: 'Northeast (5005)',
    ports: [5005],
    bbox: { minLat: 21.5, maxLat: 29.5, minLng: 88.0, maxLng: 97.5 },
  },
  {
    name: 'south',
    label: 'South India (KA/TN/KL/AP/TS)',
    shortLabel: 'South (5006)',
    ports: [5006],
    bbox: { minLat: 8.0, maxLat: 20.0, minLng: 74.0, maxLng: 85.5 },
  },
];

const ALL_LOCAL_PORTS = [5001, 5002, 5003, 5004, 5005, 5006];

// In-memory request log buffer (keeps last 50 requests)
let requestCounter = 0;
const recentLogs = [];

function logToFile(line) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${line}\n`;
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch { /* ignore */ }
}

function recordLog(reqInfo) {
  recentLogs.unshift(reqInfo);
  if (recentLogs.length > 60) recentLogs.pop();
}

/** Extract coordinate pairs from OSRM URL path */
function extractCoords(urlPath) {
  const match = urlPath.match(/\/(?:route|table|nearest|trip|match)\/v1\/[^/]+\/([^?]+)/);
  if (!match) return [];
  const coordStr = match[1];
  const parts = coordStr.split(';');
  const coords = [];
  for (const p of parts) {
    const [lngStr, latStr] = p.split(',');
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      coords.push({ lat, lng });
    }
  }
  return coords;
}

/** Score and sort zones for given coordinates */
function prioritizeZones(coords) {
  if (!coords.length) return ZONES;
  const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
  const avgLng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;

  const matches = [];
  const others = [];

  for (const zone of ZONES) {
    const inBbox =
      avgLat >= zone.bbox.minLat &&
      avgLat <= zone.bbox.maxLat &&
      avgLng >= zone.bbox.minLng &&
      avgLng <= zone.bbox.maxLng;

    if (inBbox) matches.push(zone);
    else others.push(zone);
  }

  return [...matches, ...others];
}

/** Query a local OSRM port */
function queryPort(port, pathWithQuery, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: pathWithQuery,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'TREK-OSRM-Gateway' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (data.code === 'Ok' && Array.isArray(data.waypoints)) {
                const maxSnap = 15000;
                const valid = data.waypoints.every((w) => typeof w.distance === 'number' && w.distance <= maxSnap);
                const isDegenerate = data.routes && data.routes.length > 0 && data.routes[0].distance === 0 && data.waypoints.length >= 2 && (data.waypoints[0].distance > 200 || data.waypoints[1].distance > 200);
                if (valid && !isDegenerate) {
                  return resolve({ ok: true, port, data, raw: body });
                }
              }
            } catch { /* json error */ }
          }
          resolve({ ok: false, port, statusCode: res.statusCode });
        });
      }
    );
    req.on('error', () => resolve({ ok: false, port }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, port }); });
  });
}

/** Query Public OSRM Fallback */
function queryPublicOsrm(pathWithQuery, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const targetUrl = `https://router.project-osrm.org${pathWithQuery}`;
    const req = https.get(
      targetUrl,
      {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'TREK-MultiZone-Gateway/1.0' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (data.code === 'Ok') {
                return resolve({ ok: true, source: 'public-osrm', data, raw: body });
              }
            } catch { /* json err */ }
          }
          resolve({ ok: false });
        });
      }
    );
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

/** Quick Health Check for All 6 Zones */
async function checkHealth() {
  const testCoords = '72.8777,19.0760;72.8800,19.0800'; // Mumbai
  const results = {};

  for (const port of ALL_LOCAL_PORTS) {
    const start = Date.now();
    const res = await queryPort(port, `/route/v1/driving/${testCoords}?overview=false`, 600);
    const latency = Date.now() - start;
    results[port] = {
      online: res.ok || res.statusCode === 200 || res.statusCode === 400,
      responsive: res.ok,
      latencyMs: latency,
    };
  }
  return results;
}

function renderDashboardHtml(health) {
  const rows = recentLogs.map((l) => `
    <tr>
      <td class="mono">${l.time}</td>
      <td><span class="badge ${l.clientType === 'Railway' ? 'badge-railway' : 'badge-local'}">${l.clientType}</span></td>
      <td class="mono">${l.clientIp}</td>
      <td class="mono small">${l.coords}</td>
      <td><span class="badge ${l.source.startsWith('self-hosted') ? 'badge-success' : 'badge-warn'}">${l.sourceName}</span></td>
      <td class="mono text-right">${l.distance}</td>
      <td class="mono text-right">${l.duration}</td>
      <td class="mono text-right bold">${l.latency}ms</td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="text-center empty">No requests received yet. Send a route from Railway or local app to see live logs!</td></tr>';

  const zoneBadges = ZONES.map((z) => {
    const port = z.ports[0];
    const isOnline = health[port]?.online;
    return `
      <div class="zone-card ${isOnline ? 'online' : 'offline'}">
        <div class="zone-header">
          <span class="dot"></span>
          <strong>${z.shortLabel}</strong>
        </div>
        <div class="zone-sub">${z.label.split('(')[1]?.replace(')', '') || ''}</div>
        <div class="zone-status">${isOnline ? `Online (${health[port]?.latencyMs}ms)` : 'Offline'}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="3">
  <title>TREK OSRM Multi-Zone Gateway — Live Logs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 24px; font-size: 14px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #1e293b; }
    h1 { font-size: 22px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    .pulse { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .meta { font-size: 13px; color: #94a3b8; }
    .zones-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .zone-card { background: #1e293b; border-radius: 8px; padding: 12px 16px; border-left: 4px solid #64748b; }
    .zone-card.online { border-left-color: #22c55e; background: #13271f; }
    .zone-card.offline { border-left-color: #ef4444; opacity: 0.7; }
    .zone-header { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #f1f5f9; }
    .zone-card.online .dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; }
    .zone-card.offline .dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; }
    .zone-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .zone-status { font-size: 12px; margin-top: 6px; font-weight: 600; color: #cbd5e1; }
    .table-container { background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #0f172a; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 14px; border-bottom: 1px solid #334155; }
    td { padding: 10px 14px; border-bottom: 1px solid #1e293b; font-size: 13px; }
    tr:hover { background: #283548; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
    .small { font-size: 11px; color: #94a3b8; }
    .bold { font-weight: 700; color: #38bdf8; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .empty { padding: 36px; color: #64748b; font-style: italic; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-railway { background: #702e82; color: #f3e8ff; }
    .badge-local { background: #0369a1; color: #e0f2fe; }
    .badge-success { background: #14532d; color: #86efac; }
    .badge-warn { background: #854d0e; color: #fef08a; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1><span class="pulse"></span> TREK Multi-Zone OSRM Gateway</h1>
        <div class="meta" style="margin-top: 4px;">Port 5000 &bull; Auto-Routes 6 Indian Zones &bull; Cloudflare Tunnel Ready</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 700; color: #38bdf8;">${requestCounter} Requests</div>
        <div class="meta">Auto-refreshing every 3s</div>
      </div>
    </header>

    <div class="zones-grid">
      ${zoneBadges}
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Client</th>
            <th>IP Address</th>
            <th>GPS Coordinates</th>
            <th>Served By</th>
            <th class="text-right">Distance</th>
            <th class="text-right">Duration</th>
            <th class="text-right">Latency</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-Powered-By', 'TREK-OSRM-MultiZone-Gateway');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Ignore favicon without counting
  if (url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  // 1. Dashboard Web UI
  if (url === '/' || url === '/dashboard') {
    const health = await checkHealth();
    const html = renderDashboardHtml(health);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // 2. Health JSON API
  if (url === '/health') {
    const health = await checkHealth();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify(
        {
          status: 'ok',
          service: 'TREK Multi-Zone OSRM Gateway',
          gatewayPort: GATEWAY_PORT,
          totalRoutesServed: requestCounter,
          zones: ZONES.map((z) => ({ name: z.name, label: z.label, ports: z.ports })),
          zoneHealth: health,
          recentRequests: recentLogs.slice(0, 10),
        },
        null,
        2
      )
    );
  }

  // 3. Raw Logs JSON API
  if (url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(recentLogs, null, 2));
  }

  // Only count real OSRM requests
  const reqNum = ++requestCounter;
  const startTime = Date.now();

  const clientIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const isRailway = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['host']?.includes('trycloudflare.com');
  const clientType = isRailway ? 'Railway' : 'Local';

  const coords = extractCoords(url);
  const coordsStr = coords.length ? coords.map((c) => `${c.lng.toFixed(3)},${c.lat.toFixed(3)}`).join(' -> ') : 'N/A';

  const nowTimeStr = new Date().toLocaleTimeString('en-GB');
  console.log(`\n[${nowTimeStr}] 📡 [REQ #${reqNum}] ${req.method} ${url.split('?')[0]}`);
  console.log(`           Client: ${clientType} (${clientIp}) | GPS: ${coordsStr}`);
  logToFile(`[REQ #${reqNum}] ${req.method} ${url} | Client: ${clientType} (${clientIp})`);

  const prioritized = prioritizeZones(coords);

  const portsToTry = [];
  for (const zone of prioritized) {
    for (const p of zone.ports) {
      if (!portsToTry.includes(p)) portsToTry.push(p);
    }
  }
  for (const p of ALL_LOCAL_PORTS) {
    if (!portsToTry.includes(p)) portsToTry.push(p);
  }

  // 1. Try prioritized zone ports sequentially/fast
  for (const port of portsToTry) {
    const result = await queryPort(port, url, 1200);
    if (result.ok) {
      const latency = Date.now() - startTime;
      const zoneObj = ZONES.find((z) => z.ports.includes(port));
      const sourceName = zoneObj ? zoneObj.shortLabel : `Port ${port}`;
      const dist = result.data?.routes?.[0]?.distance ? `${(result.data.routes[0].distance / 1000).toFixed(1)} km` : '-';
      const dur = result.data?.routes?.[0]?.duration ? `${Math.round(result.data.routes[0].duration / 60)} min` : '-';

      console.log(`           ✅ [SERVED #${reqNum}] by ${sourceName} in ${latency}ms | ${dist}, ${dur}`);
      logToFile(`[SERVED #${reqNum}] ${sourceName} in ${latency}ms | ${dist}`);

      recordLog({
        id: reqNum,
        time: nowTimeStr,
        clientType,
        clientIp: String(clientIp).replace('::ffff:', ''),
        coords: coordsStr,
        source: `self-hosted-port-${port}`,
        sourceName,
        distance: dist,
        duration: dur,
        latency,
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-OSRM-Source': `self-hosted-port-${port}`,
      });
      return res.end(result.raw);
    }
  }

  // 2. If primary ports fail, query all remaining ports in parallel
  const parallelPromises = ALL_LOCAL_PORTS.map((p) => queryPort(p, url, 2000));
  const results = await Promise.all(parallelPromises);
  const matched = results.find((r) => r.ok);
  if (matched) {
    const latency = Date.now() - startTime;
    const zoneObj = ZONES.find((z) => z.ports.includes(matched.port));
    const sourceName = zoneObj ? zoneObj.shortLabel : `Port ${matched.port}`;
    const dist = matched.data?.routes?.[0]?.distance ? `${(matched.data.routes[0].distance / 1000).toFixed(1)} km` : '-';
    const dur = matched.data?.routes?.[0]?.duration ? `${Math.round(matched.data.routes[0].duration / 60)} min` : '-';

    console.log(`           ✅ [SERVED #${reqNum}] by ${sourceName} in ${latency}ms | ${dist}, ${dur}`);
    logToFile(`[SERVED #${reqNum}] ${sourceName} in ${latency}ms | ${dist}`);

    recordLog({
      id: reqNum,
      time: nowTimeStr,
      clientType,
      clientIp: String(clientIp).replace('::ffff:', ''),
      coords: coordsStr,
      source: `self-hosted-port-${matched.port}`,
      sourceName,
      distance: dist,
      duration: dur,
      latency,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-OSRM-Source': `self-hosted-port-${matched.port}`,
    });
    return res.end(matched.raw);
  }

  // 3. Fallback: Seamlessly query public OSRM so answer is ALWAYS generated
  const fallback = await queryPublicOsrm(url);
  if (fallback.ok) {
    const latency = Date.now() - startTime;
    const dist = fallback.data?.routes?.[0]?.distance ? `${(fallback.data.routes[0].distance / 1000).toFixed(1)} km` : '-';
    const dur = fallback.data?.routes?.[0]?.duration ? `${Math.round(fallback.data.routes[0].duration / 60)} min` : '-';

    console.log(`           🌐 [SERVED #${reqNum}] by Public OSRM Fallback in ${latency}ms | ${dist}, ${dur}`);
    logToFile(`[SERVED #${reqNum}] Public OSRM Fallback in ${latency}ms | ${dist}`);

    recordLog({
      id: reqNum,
      time: nowTimeStr,
      clientType,
      clientIp: String(clientIp).replace('::ffff:', ''),
      coords: coordsStr,
      source: 'public-osrm',
      sourceName: 'Public Fallback',
      distance: dist,
      duration: dur,
      latency,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-OSRM-Source': 'public-osrm-fallback',
    });
    return res.end(fallback.raw);
  }

  // 4. Return standard OSRM NoRoute error
  const latency = Date.now() - startTime;
  console.log(`           ❌ [FAIL #${reqNum}] No route found in ${latency}ms`);
  logToFile(`[FAIL #${reqNum}] No route found in ${latency}ms`);

  res.writeHead(400, { 'Content-Type': 'application/json' });
  return res.end(
    JSON.stringify({
      code: 'NoRoute',
      message: 'Impossible route between points across available OSRM zone engines.',
    })
  );
});

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`🚀 TREK Multi-Zone OSRM Gateway LIVE on http://0.0.0.0:${GATEWAY_PORT}`);
  console.log(`📊 Live Dashboard:  http://localhost:${GATEWAY_PORT}/`);
  console.log(`🩺 Health API:      http://localhost:${GATEWAY_PORT}/health`);
  console.log(`📄 File Logs:       ${LOG_FILE}`);
  console.log('Serving 6 India OSRM Zones:');
  ZONES.forEach((z) => console.log(`  - ${z.label.padEnd(42)} -> Port ${z.ports[0]}`));
  console.log('Public Fallback:    Enabled (automatic failover)');
  console.log('================================================================');
});
