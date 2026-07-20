// Public live-tracking page served at GET /track/:token. Rendered for emergency
// contacts who are NOT app users, so it must work in any mobile browser with no
// login. It polls the same-origin /api/track/:token endpoint every 15s (CORS is
// intentionally disabled server-side, which is fine because this is same-origin).
// Leaflet (CDN, no API key) draws a live marker; an "Open in Google Maps" button
// is the always-works fallback.
export function trackPageHtml(token: string): string {
  // token is a 64-char hex string; safe to interpolate, but keep it JSON-encoded.
  const tokenJson = JSON.stringify(token);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Live SOS Location</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1c0a10; color: #ffe4e6; }
  header { padding: 1rem 1.25rem; display: flex; align-items: center; gap: 0.6rem; background: #dc2626; color: #fff; }
  header .dot { width: 12px; height: 12px; border-radius: 999px; background: #fff; animation: pulse 1.2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  header h1 { font-size: 1.05rem; margin: 0; font-weight: 700; }
  #status { padding: 0.75rem 1.25rem; font-size: 0.95rem; opacity: 0.9; }
  #map { height: 60vh; width: 100%; background: #2a1119; }
  .bar { padding: 1rem 1.25rem; }
  a.maps { display: block; text-align: center; background: #e11d48; color: #fff; text-decoration: none; font-weight: 700; padding: 0.9rem; border-radius: 0.9rem; }
  a.maps:hover { background: #be123c; }
  .resolved { background: #065f46 !important; }
  .muted { opacity: 0.6; font-size: 0.85rem; margin-top: 0.5rem; }
</style>
</head>
<body>
  <header><span class="dot" id="dot"></span><h1 id="title">Live SOS Location</h1></header>
  <div id="status">Connecting…</div>
  <div id="map"></div>
  <div class="bar">
    <a class="maps" id="mapsLink" href="#" target="_blank" rel="noopener">Open in Google Maps</a>
    <div class="muted" id="updated"></div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const TOKEN = ${tokenJson};
    let map, marker, timer;
    const statusEl = document.getElementById('status');
    const titleEl = document.getElementById('title');
    const updatedEl = document.getElementById('updated');
    const mapsLink = document.getElementById('mapsLink');
    const header = document.querySelector('header');
    const dot = document.getElementById('dot');

    function ensureMap(lat, lng) {
      if (!map) {
        map = L.map('map').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap', maxZoom: 19,
        }).addTo(map);
        marker = L.marker([lat, lng]).addTo(map);
      } else {
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
      }
    }

    function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

    async function poll() {
      try {
        const r = await fetch('/api/track/' + TOKEN, { cache: 'no-store' });
        if (r.status === 404) { statusEl.textContent = 'This tracking link is invalid or has expired.'; stopPolling(); return; }
        const body = await r.json();
        if (!body.success) { statusEl.textContent = 'Unable to load location.'; return; }
        const d = body.data;
        const who = d.userName || 'Someone';
        titleEl.textContent = who + "'s SOS";

        const coords = d.latest || d.initialLocation;
        if (coords) {
          ensureMap(coords.lat, coords.lng);
          mapsLink.href = 'https://maps.google.com/?q=' + coords.lat + ',' + coords.lng;
        }

        if (d.status !== 'active') {
          statusEl.textContent = who + ' has marked themselves safe. This alert is resolved.';
          header.classList.add('resolved');
          dot.style.display = 'none';
          updatedEl.textContent = d.resolvedAt ? 'Resolved at ' + new Date(d.resolvedAt).toLocaleString() : '';
          stopPolling();
          return;
        }

        statusEl.textContent = coords
          ? 'Live location — sharing while ' + who + "'s app is open."
          : 'SOS active. Waiting for a location fix…';
        if (d.latest && d.latest.at) {
          updatedEl.textContent = 'Last updated ' + new Date(d.latest.at).toLocaleTimeString();
        }
      } catch (e) {
        statusEl.textContent = 'Connection problem — retrying…';
      }
    }

    poll();
    timer = setInterval(poll, 15000);
  </script>
</body>
</html>`;
}
