/**
 * TREK Multi-Zone OSRM Gateway
 *
 * Listens on Port 5000 and routes incoming OSRM requests (from local app or
 * Cloudflare Tunnel) to the appropriate zone container among all 6 India OSRM zones:
 *
 *   1. North     (Port 5001) - Delhi, Punjab, Haryana, HP, J&K, UP, Rajasthan
 *   2. South     (Port 5002) - Karnataka, Tamil Nadu, Kerala, AP, Telangana
 *   3. West      (Port 5003) - Gujarat, Maharashtra, Goa
 *   4. East      (Port 5004) - WB, Bihar, Jharkhand, Odisha
 *   5. Central   (Port 5005) - MP, Chhattisgarh
 *   6. Northeast (Port 5006) - Assam, Meghalaya, Arunachal, Sikkim, etc.
 *
 * Fallback: If local zone containers are down or the route crosses zones,
 * automatically proxies to public OSRM so an answer is ALWAYS generated.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const GATEWAY_PORT = Number(process.env.OSRM_GATEWAY_PORT || 5000);

const ZONES = [
  {
    name: 'north',
    label: 'North India (DL/PB/HR/UP/RJ/UK/HP/JK)',
    ports: [5001],
    bbox: { minLat: 24.0, maxLat: 37.5, minLng: 73.0, maxLng: 84.5 },
  },
  {
    name: 'west',
    label: 'West India (GJ/MH/GA)',
    ports: [5002],
    bbox: { minLat: 14.5, maxLat: 26.5, minLng: 68.0, maxLng: 78.5 },
  },
  {
    name: 'east',
    label: 'East India (WB/BR/JH/OD)',
    ports: [5003],
    bbox: { minLat: 18.0, maxLat: 28.0, minLng: 82.0, maxLng: 90.0 },
  },
  {
    name: 'central',
    label: 'Central India (MP/CG)',
    ports: [5004],
    bbox: { minLat: 17.5, maxLat: 27.0, minLng: 74.5, maxLng: 84.5 },
  },
  {
    name: 'northeast',
    label: 'Northeast India (AS/ML/AR/NL/MN/MZ/TR/SK)',
    ports: [5005],
    bbox: { minLat: 21.5, maxLat: 29.5, minLng: 88.0, maxLng: 97.5 },
  },
  {
    name: 'south',
    label: 'South India (KA/TN/KL/AP/TS)',
    ports: [5006],
    bbox: { minLat: 8.0, maxLat: 20.0, minLng: 74.0, maxLng: 85.5 },
  },
];

// All active ports to probe
const ALL_LOCAL_PORTS = [5001, 5002, 5003, 5004, 5005, 5006];

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

  // Average position of points
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
              // Validate snap distance & valid route distance
              if (data.code === 'Ok' && Array.isArray(data.waypoints)) {
                const maxSnap = 15000; // 15 km max acceptable snap
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
    const res = await queryPort(port, `/route/v1/driving/${testCoords}?overview=false`, 800);
    const latency = Date.now() - start;
    results[port] = {
      online: res.ok || res.statusCode === 200 || res.statusCode === 400,
      responsive: res.ok,
      latencyMs: latency,
    };
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-Powered-By', 'TREK-OSRM-MultiZone-Gateway');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url || '/';

  // Health endpoint
  if (url === '/health' || url === '/') {
    const health = await checkHealth();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify(
        {
          status: 'ok',
          service: 'TREK Multi-Zone OSRM Gateway',
          gatewayPort: GATEWAY_PORT,
          zones: ZONES.map((z) => ({ name: z.name, label: z.label, ports: z.ports })),
          zoneHealth: health,
        },
        null,
        2
      )
    );
  }

  const coords = extractCoords(url);
  const prioritized = prioritizeZones(coords);

  // Collect ports to check in prioritized order
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
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-OSRM-Source': `self-hosted-port-${matched.port}`,
    });
    return res.end(matched.raw);
  }

  // 3. Fallback: Seamlessly query public OSRM so answer is ALWAYS generated
  const fallback = await queryPublicOsrm(url);
  if (fallback.ok) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-OSRM-Source': 'public-osrm-fallback',
    });
    return res.end(fallback.raw);
  }

  // 4. Return standard OSRM NoRoute error
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
  console.log(`🚀 TREK Multi-Zone OSRM Gateway listening on http://0.0.0.0:${GATEWAY_PORT}`);
  console.log('Serving 6 India OSRM Zones:');
  ZONES.forEach((z) => console.log(`  - ${z.label.padEnd(42)} -> Ports ${z.ports.join(', ')}`));
  console.log('Public OSRM Fallback: Enabled (automatic failover)');
  console.log('================================================================');
});
