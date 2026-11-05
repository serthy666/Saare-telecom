// Statistiques de la boutique BIMAK Store (adresse /api/stats).
// Le navigateur des clients envoie de petits événements : visite, fiche vue, clic « Commander »,
// recherche sans résultat. On ne garde que des compteurs par jour, dans la base Cloudflare D1
// liée au Worker sous le nom STATS : ni adresse IP, ni numéro, ni rien qui identifie un client.
// Le gérant lit ces compteurs depuis son onglet (action « stats » de /api/gerant).

const TYPES = new Set(["visite", "visiteur", "vue", "commande", "vide"]);
const ID = /^[a-z0-9]{1,40}$/;
const SOURCE = /^[a-z0-9-]{1,20}$/;
const ROBOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview/i;
const MAX_EVENEMENTS = 5;
const GARDER_JOURS = 400;

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  // Rien à faire tant que la base n'est pas liée : la boutique marche quand même
  if (!env.STATS) return new Response(null, { status: 204 });
  const origine = request.headers.get("origin");
  if (origine && origine !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (ROBOT.test(request.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  let corps;
  try {
    const texte = await request.text();
    if (texte.length > 2000) return new Response(null, { status: 413 });
    corps = JSON.parse(texte);
  } catch (e) { return new Response(null, { status: 400 }); }
  const lignes = [];
  for (const ev of (Array.isArray(corps && corps.e) ? corps.e : []).slice(0, MAX_EVENEMENTS)) lignes.push(...traduire(ev));
  if (!lignes.length) return new Response(null, { status: 204 });
  try {
    await preparer(env);
    const j = jour(0);
    const ajout = env.STATS.prepare("INSERT INTO compteurs (jour, type, cle, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (jour, type, cle) DO UPDATE SET n = n + 1");
    const ordres = lignes.map(([type, cle]) => ajout.bind(j, type, cle));
    // De temps en temps, on efface ce qui a plus de 400 jours
    if (Math.random() < 0.01) ordres.push(env.STATS.prepare("DELETE FROM compteurs WHERE jour < ?1").bind(jour(GARDER_JOURS)));
    await env.STATS.batch(ordres);
  } catch (e) {
    console.log("Statistiques :", e && e.stack || e);
  }
  return new Response(null, { status: 204 });
}

// Un événement du navigateur devient une ou deux lignes de compteur [type, clé]
function traduire(ev) {
  if (!ev || !TYPES.has(ev.t)) return [];
  const s = SOURCE.test(String(ev.s || "")) ? String(ev.s) : "direct";
  if (ev.t === "visite") return [["visite", ""], ["source", s]];
  if (ev.t === "visiteur") return [["visiteur", ""]];
  if (ev.t === "vue") return ID.test(String(ev.p || "")) ? [["vue", ev.p]] : [];
  if (ev.t === "commande") return ID.test(String(ev.p || "")) ? [["commande", ev.p], ["commande-source", s]] : [];
  if (ev.t === "vide") {
    const q = String(ev.q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 +.-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
    return q.length >= 2 ? [["vide", q]] : [];
  }
  return [];
}

// Jour au Cameroun (UTC+1), il y a « recul » jours, au format 2026-11-05
export function jour(recul) {
  return new Date(Date.now() + 3600e3 - recul * 864e5).toISOString().slice(0, 10);
}

// La table est créée au premier appel (une seule fois par base)
const pretes = new WeakMap();
function preparer(env) {
  const base = env.STATS;
  if (!pretes.has(base)) pretes.set(base, base.prepare("CREATE TABLE IF NOT EXISTS compteurs (jour TEXT NOT NULL, type TEXT NOT NULL, cle TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, type, cle))").run().catch(e => { pretes.delete(base); throw e; }));
  return pretes.get(base);
}

/* Lecture pour l'onglet Gérant (la session est vérifiée par /api/gerant avant l'appel) */
export async function lireStats(env, jours) {
  if (!env.STATS) return { actif: false };
  jours = [1, 7, 30].includes(jours) ? jours : 7;
  await preparer(env);
  const depuis = jour(jours - 1);
  const [parJour, articles, vides, sources] = (await env.STATS.batch([
    env.STATS.prepare("SELECT jour, type, SUM(n) AS n FROM compteurs WHERE jour >= ?1 AND type IN ('visite', 'visiteur', 'vue', 'commande') GROUP BY jour, type").bind(depuis),
    env.STATS.prepare("SELECT type, cle, SUM(n) AS n FROM compteurs WHERE jour >= ?1 AND type IN ('vue', 'commande') GROUP BY type, cle").bind(depuis),
    env.STATS.prepare("SELECT cle, SUM(n) AS n FROM compteurs WHERE jour >= ?1 AND type = 'vide' GROUP BY cle ORDER BY n DESC, cle LIMIT 20").bind(depuis),
    env.STATS.prepare("SELECT type, cle, SUM(n) AS n FROM compteurs WHERE jour >= ?1 AND type IN ('source', 'commande-source') GROUP BY type, cle").bind(depuis)
  ])).map(r => r.results || []);

  const jours_ = [];
  for (let i = jours - 1; i >= 0; i--) jours_.push({ jour: jour(i), visites: 0, visiteurs: 0, vues: 0, commandes: 0 });
  const index = Object.fromEntries(jours_.map(j => [j.jour, j]));
  const nom = { visite: "visites", visiteur: "visiteurs", vue: "vues", commande: "commandes" };
  for (const r of parJour) if (index[r.jour]) index[r.jour][nom[r.type]] = Number(r.n);

  const parArticle = {};
  for (const r of articles) { const a = parArticle[r.cle] || (parArticle[r.cle] = { id: r.cle, vues: 0, commandes: 0 }); a[r.type === "vue" ? "vues" : "commandes"] = Number(r.n); }
  const parSource = {};
  for (const r of sources) { const a = parSource[r.cle] || (parSource[r.cle] = { source: r.cle, visites: 0, commandes: 0 }); a[r.type === "source" ? "visites" : "commandes"] = Number(r.n); }

  return {
    actif: true, jours, depuis,
    parJour: jours_,
    articles: Object.values(parArticle).sort((a, b) => b.vues - a.vues || b.commandes - a.commandes),
    vides: vides.map(r => ({ q: r.cle, n: Number(r.n) })),
    sources: Object.values(parSource).sort((a, b) => b.visites - a.visites || b.commandes - a.commandes)
  };
}
