// Serveur de test : sert site/ comme Cloudflare Pages et fait tourner functions/api/gerant.js,
// avec un faux GitHub (dépôt en mémoire) et une fausse vérification Google.
// Lancer seul pour essayer en local : node tests/serveur.mjs  puis ouvrir http://localhost:8788
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CLIENT_ID = "test-client.apps.googleusercontent.com";
export const PROPRIO = "saaretelecom.shop@gmail.com";

function sha1(buf) { return crypto.createHash("sha1").update(buf).digest("hex"); }

// Faux dépôt : chaque commit garde une copie complète des fichiers
export function fauxDepot() {
  const commits = new Map(), blobs = new Map();
  const depart = new Map();
  for (const f of ["site/donnees/produits.json", "site/donnees/comptes.json"]) depart.set(f, fs.readFileSync(path.join(RACINE, f)));
  const premier = sha1("depart");
  commits.set(premier, { fichiers: depart, parents: [], message: "Départ" });
  const depot = { head: premier, commits, blobs, journal: [], pannes: 0 };
  depot.fichiers = (ref) => commits.get(ref && commits.has(ref) ? ref : depot.head).fichiers;
  depot.lire = (chemin) => { const b = depot.fichiers().get(chemin); return b ? b.toString("utf8") : null; };
  return depot;
}

function reponse(statut, corps) { return new Response(corps == null ? null : JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } }); }

function fauxGithub(depot, url, init) {
  const u = new URL(url), m = (init && init.method) || "GET";
  const p = u.pathname.replace(/^\/repos\/serthy666\/saare-telecom/, "");
  const corps = init && init.body ? JSON.parse(init.body) : null;
  if (!/^Bearer test-jeton$/.test((init.headers || {}).authorization || "")) return reponse(401, { message: "Bad credentials" });
  if (depot.pannes > 0) { depot.pannes--; return reponse(500, { message: "panne" }); }
  let r;
  if ((r = p.match(/^\/contents\/(.+)$/))) {
    const chemin = decodeURIComponent(r[1]);
    if (m === "GET") {
      const ref = u.searchParams.get("ref");
      const b = depot.fichiers(ref === "main" ? null : ref).get(chemin);
      return b ? reponse(200, { sha: sha1(b), content: b.toString("base64") }) : reponse(404, { message: "Not Found" });
    }
    if (m === "PUT") {
      const actuel = depot.fichiers().get(chemin);
      if ((actuel ? sha1(actuel) : undefined) !== corps.sha) return reponse(409, { message: "sha mismatch" });
      const fichiers = new Map(depot.fichiers());
      fichiers.set(chemin, Buffer.from(corps.content, "base64"));
      const sha = sha1(depot.head + corps.message + Date.now() + Math.random());
      depot.commits.set(sha, { fichiers, parents: [depot.head], message: corps.message });
      depot.head = sha; depot.journal.push(corps.message);
      return reponse(200, { commit: { sha } });
    }
  }
  if (p === "/git/ref/heads/main" && m === "GET") return reponse(200, { object: { sha: depot.head } });
  if ((r = p.match(/^\/git\/commits\/(\w+)$/)) && m === "GET") return depot.commits.has(r[1]) ? reponse(200, { tree: { sha: "arbre-" + r[1] } }) : reponse(404, {});
  if (p === "/git/blobs" && m === "POST") { const b = Buffer.from(corps.content, "base64"); const sha = sha1(b); depot.blobs.set(sha, b); return reponse(201, { sha }); }
  if (p === "/git/trees" && m === "POST") {
    const fichiers = new Map(depot.commits.get(corps.base_tree.replace(/^arbre-/, "")).fichiers);
    for (const e of corps.tree) {
      if (e.sha === null) { if (!fichiers.has(e.path)) return reponse(422, { message: "suppression d'un fichier absent " + e.path }); fichiers.delete(e.path); }
      else if (e.content != null) fichiers.set(e.path, Buffer.from(e.content, "utf8"));
      else fichiers.set(e.path, depot.blobs.get(e.sha));
    }
    const sha = "t" + sha1(String(Math.random()));
    depot.arbres = depot.arbres || new Map(); depot.arbres.set(sha, fichiers);
    return reponse(201, { sha });
  }
  if (p === "/git/commits" && m === "POST") {
    const sha = sha1(corps.message + Math.random());
    depot.commits.set(sha, { fichiers: depot.arbres.get(corps.tree), parents: corps.parents, message: corps.message });
    return reponse(201, { sha });
  }
  if (p === "/git/refs/heads/main" && m === "PATCH") {
    const c = depot.commits.get(corps.sha);
    if (!c || c.parents[0] !== depot.head) return reponse(422, { message: "Update is not a fast forward" });
    depot.head = corps.sha; depot.journal.push(c.message);
    return reponse(200, { object: { sha: corps.sha } });
  }
  return reponse(404, { message: "faux GitHub : " + m + " " + p });
}

function fauxGoogle(url) {
  const jeton = new URL(url).searchParams.get("id_token") || "";
  const m = jeton.match(/^test:(.+)$/);
  if (!m) return reponse(400, { error: "invalid_token" });
  const [email, aud] = m[1].split("|");
  return reponse(200, { iss: "https://accounts.google.com", aud: aud || CLIENT_ID, email, email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 3600) });
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

export async function demarrer({ port = 0, env = {} } = {}) {
  const depot = fauxDepot();
  const vraiFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("https://api.github.com/")) return fauxGithub(depot, u, init || {});
    if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) return fauxGoogle(u);
    return vraiFetch(url, init);
  };
  const { onRequest } = await import(path.join(RACINE, "functions/api/gerant.js"));
  const ENV = { GOOGLE_CLIENT_ID: CLIENT_ID, PROPRIETAIRE: PROPRIO, GITHUB_TOKEN: "test-jeton", GITHUB_REPO: "serthy666/saare-telecom", ...env };
  const serveur = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname === "/api/gerant") {
      const morceaux = []; for await (const c of req) morceaux.push(c);
      const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : Buffer.concat(morceaux) });
      const r = await onRequest({ request, env: ENV });
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    // Comme Cloudflare après republication : données et photos lues dans le dépôt
    let chemin = decodeURIComponent(u.pathname); if (chemin === "/") chemin = "/index.html";
    const dansDepot = depot.fichiers().get("site" + chemin);
    const surDisque = path.join(RACINE, "site", chemin);
    let contenu = null;
    if (dansDepot) contenu = dansDepot;
    else if (!/^\/(donnees|photos)\//.test(chemin) && surDisque.startsWith(path.join(RACINE, "site")) && fs.existsSync(surDisque) && fs.statSync(surDisque).isFile()) contenu = fs.readFileSync(surDisque);
    if (!contenu) { res.writeHead(404); res.end("introuvable"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(chemin)] || "application/octet-stream" }); res.end(contenu);
  });
  await new Promise(ok => serveur.listen(port, ok));
  const adresse = "http://localhost:" + serveur.address().port;
  return { url: adresse, depot, env: ENV, arreter: () => new Promise(ok => { serveur.close(ok); globalThis.fetch = vraiFetch; }) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const s = await demarrer({ port: 8788 });
  console.log("Boutique de test sur " + s.url + " (connexion : jeton « test:" + PROPRIO + " »)");
}
