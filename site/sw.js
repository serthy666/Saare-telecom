// Appli installée : la boutique s'ouvre même avec un réseau faible.
// Pages, script et catalogue : le réseau d'abord (toujours les derniers prix), la copie sinon.
// Images : la copie tout de suite, rafraîchie en arrière-plan. L'espace gérant (/api) et les autres sites ne passent jamais par ici.
const CACHE = "saare-v1";
const BASE = ["/", "/app.js", "/manifest.webmanifest", "/assets/accueil.webp", "/assets/logo-rond.webp", "/assets/icone-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (/^\/(assets|photos)\//.test(u.pathname)) {
    const reseau = fetch(r).then(rep => { if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(k => k.put(r, c)); } return rep; });
    e.respondWith(caches.match(r).then(m => { if (m) { e.waitUntil(reseau.catch(() => {})); return m; } return reseau; }));
    return;
  }
  // Le catalogue est demandé avec ?t=… : une seule copie, sans le paramètre
  const cle = u.pathname === "/donnees/produits.json" ? new Request(u.origin + u.pathname) : r;
  e.respondWith(fetch(r).then(rep => {
    if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(k => k.put(cle, c)); }
    return rep;
  }).catch(() => caches.match(cle, { ignoreSearch: r.mode === "navigate" }).then(m => m || (r.mode === "navigate" ? caches.match("/") : Response.error()))));
});
