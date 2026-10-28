// Espace gérant de la boutique Saaré Télécom (fonction Cloudflare Pages, adresse /api/gerant).
// Vérifie la connexion Google, contrôle la liste des Gmail autorisés et écrit les produits
// et les photos dans le dépôt GitHub. Le site se republie tout seul après chaque commit.
//
// Variables Cloudflare (Paramètres > Variables et secrets) :
//   GOOGLE_CLIENT_ID  identifiant du client OAuth Google (…apps.googleusercontent.com)
//   PROPRIETAIRE      Gmail du propriétaire, qui ne peut pas être retiré depuis la page
//   GITHUB_TOKEN      jeton « fine-grained » limité à ce dépôt, droit Contents en écriture (secret)
//   GITHUB_REPO       facultatif, par défaut serthy666/saare-telecom
//   GITHUB_BRANCH     facultatif, par défaut main
//   SESSION_SECRET    facultatif, clé des sessions (sinon dérivée du jeton GitHub)

const FICHIER_PRODUITS = "site/donnees/produits.json";
const FICHIER_COMPTES = "site/donnees/comptes.json";
const DOSSIER_PHOTOS = "site/photos/";
const DUREE_SESSION = 8 * 3600; // secondes
const RAYONS = ["tel", "pc", "autres"];
const ETATS = ["neuf", "occasion", "pieces"];
const OFFRES = ["promo", "flash", "bf"];
const CHEMIN_PHOTO = /^photos\/[a-z0-9-]{1,80}\.(jpg|webp|png)$/;
const GMAIL = /^[a-z0-9.+_-]+@(gmail|googlemail)\.com$/;
const PHOTO_MAX = 1500000; // octets après décodage
const PRODUITS_MAX = 3000;

export async function onRequest(contexte) {
  const { request, env } = contexte;
  try {
    if (request.method === "GET") {
      const action = new URL(request.url).searchParams.get("action");
      if (action === "config") return json({ clientId: env.GOOGLE_CLIENT_ID || "", pret: pret(env) });
      if (action === "donnees") return await donnees(request, env);
      return erreur(400, "Action inconnue.");
    }
    if (request.method !== "POST") return erreur(405, "Méthode non acceptée.");
    if (!pret(env)) return erreur(503, "L'espace gérant n'est pas encore configuré.");
    let corps;
    try { corps = await request.json(); } catch (e) { return erreur(400, "Requête illisible."); }
    switch (corps && corps.action) {
      case "connexion": return await connexion(corps, env);
      case "enregistrer": return await enregistrer(request, corps, env);
      case "inviter": return await inviter(request, corps, env);
      case "retirer": return await retirer(request, corps, env);
      default: return erreur(400, "Action inconnue.");
    }
  } catch (e) {
    if (e instanceof Refus) return erreur(e.statut, e.message);
    console.log("Erreur gérant :", e && e.stack || e);
    return erreur(500, "Erreur du serveur, réessayez dans un instant.");
  }
}

class Refus extends Error { constructor(statut, message) { super(message); this.statut = statut; } }
function json(objet, statut = 200) {
  return new Response(JSON.stringify(objet), { status: statut, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function erreur(statut, message) { return json({ erreur: message }, statut); }
function pret(env) { return !!(env.GOOGLE_CLIENT_ID && env.PROPRIETAIRE && env.GITHUB_TOKEN); }
function proprietaire(env) { return String(env.PROPRIETAIRE || "").trim().toLowerCase(); }

/* Connexion : jeton Google vérifié, puis adresse cherchée dans la liste des comptes */
async function connexion(corps, env) {
  const identite = await verifierGoogle(String(corps.credential || ""), env);
  const email = identite.email;
  const { comptes, sha } = await lireComptes(env);
  const estProprio = email === proprietaire(env);
  const compte = comptes.find(c => c.email === email);
  if (!estProprio && !compte) throw new Refus(403, "Le compte " + email + " n'a pas accès à l'espace gérant. Demandez au propriétaire de l'ajouter.");
  if (compte && compte.statut !== "actif") {
    compte.statut = "actif";
    compte.depuis = new Date().toISOString().slice(0, 10);
    await ecrireFichier(env, FICHIER_COMPTES, texteJson({ comptes }), sha, email + " a accepté l'invitation d'administrateur");
  }
  const expire = Math.floor(Date.now() / 1000) + DUREE_SESSION;
  return json({ jeton: await signer({ e: email, x: expire }, env), email, proprietaire: estProprio, expire });
}

async function verifierGoogle(credential, env) {
  if (!credential || credential.length > 5000) throw new Refus(401, "Connexion Google manquante.");
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  if (!r.ok) throw new Refus(401, "Connexion Google refusée, réessayez.");
  const t = await r.json();
  const emetteurOk = t.iss === "accounts.google.com" || t.iss === "https://accounts.google.com";
  const encoreValide = Number(t.exp) > Date.now() / 1000;
  const verifie = t.email_verified === true || t.email_verified === "true";
  if (t.aud !== env.GOOGLE_CLIENT_ID || !emetteurOk || !encoreValide || !verifie || !t.email) throw new Refus(401, "Connexion Google refusée, réessayez.");
  return { email: String(t.email).toLowerCase() };
}

/* Session de 8 heures : adresse et date d'expiration signées (HMAC) */
async function cle(env) {
  const secret = env.SESSION_SECRET || "saare-session:" + env.GITHUB_TOKEN;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
function b64url(octets) { let s = ""; for (const o of octets) s += String.fromCharCode(o); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function deB64url(t) { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); }
async function signer(contenu, env) {
  const charge = b64url(new TextEncoder().encode(JSON.stringify(contenu)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await cle(env), new TextEncoder().encode(charge)));
  return charge + "." + b64url(sig);
}
// Renvoie l'adresse connectée, après avoir revérifié qu'elle est toujours autorisée
async function session(request, env, comptes) {
  const jeton = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [charge, sig] = jeton.split(".");
  if (!charge || !sig) throw new Refus(401, "Session terminée, reconnectez-vous.");
  let valide = false, contenu = null;
  try {
    valide = await crypto.subtle.verify("HMAC", await cle(env), deB64url(sig), new TextEncoder().encode(charge));
    contenu = JSON.parse(new TextDecoder().decode(deB64url(charge)));
  } catch (e) { valide = false; }
  if (!valide || !contenu || !(contenu.x > Date.now() / 1000)) throw new Refus(401, "Session terminée, reconnectez-vous.");
  const email = String(contenu.e);
  if (email !== proprietaire(env) && !comptes.some(c => c.email === email)) throw new Refus(403, "Ce compte n'a plus accès à l'espace gérant.");
  return email;
}

/* Lecture pour le tableau de bord : toujours la dernière version du dépôt */
async function donnees(request, env) {
  if (!pret(env)) return erreur(503, "L'espace gérant n'est pas encore configuré.");
  const { comptes } = await lireComptes(env);
  const email = await session(request, env, comptes);
  const f = await lireFichier(env, FICHIER_PRODUITS);
  const contenu = f ? JSON.parse(f.texte) : { config: {}, produits: [] };
  return json({ donnees: contenu, version: f ? f.sha : null, comptes, moi: email, proprietaire: proprietaire(env) });
}

/* Enregistrer : produits, coordonnées et photos en un seul commit, donc une seule republication */
async function enregistrer(request, corps, env) {
  const { comptes } = await lireComptes(env);
  const email = await session(request, env, comptes);
  const actuel = await lireFichier(env, FICHIER_PRODUITS);
  if ((actuel ? actuel.sha : null) !== (corps.version || null)) throw new Refus(409, "Un autre administrateur vient d'enregistrer. Rechargez le tableau de bord pour repartir de sa version.");
  const ancien = actuel ? JSON.parse(actuel.texte) : { config: {}, produits: [] };
  const nouveau = nettoyer(corps.donnees);

  // Photos envoyées : seulement celles qu'un produit utilise
  const utilisees = new Set();
  nouveau.produits.forEach(p => p.photos.forEach(ph => utilisees.add(ph)));
  const envoyees = Array.isArray(corps.photos) ? corps.photos : [];
  const entrees = [], ajoutees = new Set();
  for (const ph of envoyees) {
    const chemin = String(ph && ph.chemin || "");
    if (!CHEMIN_PHOTO.test(chemin)) throw new Refus(400, "Nom de photo refusé : " + chemin);
    if (!utilisees.has(chemin) || ajoutees.has(chemin)) continue;
    const base64 = String(ph.data || "").replace(/^data:image\/[a-z]+;base64,/, "");
    if (base64.length * 0.75 > PHOTO_MAX) throw new Refus(413, "Une photo est trop lourde.");
    const blob = await github(env, "POST", "/git/blobs", { content: base64, encoding: "base64" });
    entrees.push({ path: "site/" + chemin, mode: "100644", type: "blob", sha: blob.sha });
    ajoutees.add(chemin);
  }
  // Photos qui ne servent plus : retirées du dépôt pour le garder léger
  const anciennes = new Set();
  (ancien.produits || []).forEach(p => (p.photos || []).forEach(ph => { if (CHEMIN_PHOTO.test(ph)) anciennes.add(ph); }));
  anciennes.forEach(ph => { if (!utilisees.has(ph)) entrees.push({ path: "site/" + ph, mode: "100644", type: "blob", sha: null }); });

  entrees.push({ path: FICHIER_PRODUITS, mode: "100644", type: "blob", content: texteJson(nouveau) });
  const message = resumer(ancien, nouveau) + " (" + email + ")";
  const commit = await commiter(env, entrees, message);
  const apres = await lireFichier(env, FICHIER_PRODUITS, commit);
  return json({ ok: true, version: apres ? apres.sha : null, message });
}

/* Administrateurs : seul le propriétaire invite ou retire */
async function inviter(request, corps, env) {
  const { comptes, sha } = await lireComptes(env);
  const email = await session(request, env, comptes);
  if (email !== proprietaire(env)) throw new Refus(403, "Seul le propriétaire peut inviter un administrateur.");
  const invite = String(corps.email || "").trim().toLowerCase();
  if (!GMAIL.test(invite)) throw new Refus(400, "Entrez une adresse Gmail complète, par exemple prenom.nom@gmail.com.");
  if (invite === proprietaire(env) || comptes.some(c => c.email === invite)) throw new Refus(400, "Ce compte est déjà administrateur.");
  comptes.push({ email: invite, statut: "invite", depuis: new Date().toISOString().slice(0, 10) });
  await ecrireFichier(env, FICHIER_COMPTES, texteJson({ comptes }), sha, "Invitation de " + invite + " comme administrateur (" + email + ")");
  return json({ ok: true, comptes });
}
async function retirer(request, corps, env) {
  const { comptes, sha } = await lireComptes(env);
  const email = await session(request, env, comptes);
  if (email !== proprietaire(env)) throw new Refus(403, "Seul le propriétaire peut retirer un administrateur.");
  const cible = String(corps.email || "").trim().toLowerCase();
  const reste = comptes.filter(c => c.email !== cible);
  if (reste.length === comptes.length) return json({ ok: true, comptes });
  await ecrireFichier(env, FICHIER_COMPTES, texteJson({ comptes: reste }), sha, "Retrait de l'administrateur " + cible + " (" + email + ")");
  return json({ ok: true, comptes: reste });
}

/* Contrôle de ce que la page envoie : types, longueurs et valeurs permises */
function txt(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
function entier(v) { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 1e9) : 0; }
function dateLocale(v) { const t = txt(v, 16); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) ? t : ""; }
function nettoyer(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.produits)) throw new Refus(400, "Données de la boutique illisibles.");
  if (d.produits.length > PRODUITS_MAX) throw new Refus(400, "Trop de produits.");
  const c = d.config || {};
  const config = {
    whatsapp: txt(c.whatsapp, 20).replace(/\D/g, ""),
    gmail: txt(c.gmail, 120).toLowerCase(),
    evenement: txt(c.evenement, 60),
    evenementFin: dateLocale(c.evenementFin)
  };
  const vus = new Set();
  const produits = d.produits.map(p => {
    let id = txt(p.id, 40).replace(/[^a-z0-9-]/gi, "").toLowerCase() || "p" + Math.random().toString(36).slice(2, 8);
    while (vus.has(id)) id += "x";
    vus.add(id);
    const rayon = RAYONS.includes(p.rayon) ? p.rayon : "tel";
    return {
      id, nom: txt(p.nom, 120), marque: txt(p.marque, 40), rayon,
      categorie: txt(p.categorie, 60), etat: ETATS.includes(p.etat) ? p.etat : "neuf",
      details: txt(p.details, 300), garantie: txt(p.garantie, 40),
      prix: entier(p.prix), prixPromo: entier(p.prixPromo),
      offre: OFFRES.includes(p.offre) ? p.offre : "promo", fin: dateLocale(p.fin),
      nouveau: !!p.nouveau, stock: ["peu", "epuise"].includes(p.stock) ? p.stock : "ok", visible: p.visible !== false,
      photos: (Array.isArray(p.photos) ? p.photos : []).map(x => String(x)).filter(x => CHEMIN_PHOTO.test(x)).slice(0, 12)
    };
  });
  return { config, produits };
}

/* Message du commit : qui a changé quoi, en clair */
function fcfa(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function resumer(ancien, nouveau) {
  const avant = new Map((ancien.produits || []).map(p => [p.id, p]));
  const apres = new Map(nouveau.produits.map(p => [p.id, p]));
  const lignes = [];
  nouveau.produits.forEach(p => {
    const a = avant.get(p.id);
    const nom = p.nom || "Sans nom";
    if (!a) { lignes.push("Ajout " + nom); return; }
    if (a.prix !== p.prix) lignes.push("Prix " + nom + " : " + fcfa(a.prix) + " → " + fcfa(p.prix));
    if ((a.prixPromo || 0) !== p.prixPromo) lignes.push(p.prixPromo ? "Promo " + nom + " : " + fcfa(p.prixPromo) : "Fin de promo " + nom);
    else if (p.prixPromo && (a.offre !== p.offre || a.fin !== p.fin)) lignes.push("Promo " + nom + " modifiée");
    if (a.visible !== p.visible) lignes.push((p.visible ? "Affichage " : "Masquage ") + nom);
    const autres = ["nom", "marque", "rayon", "categorie", "etat", "details", "garantie", "stock", "nouveau"].some(k => a[k] !== p[k]);
    if (autres && a.nom !== p.nom) lignes.push("Renommage " + (a.nom || "Sans nom") + " → " + nom);
    else if (autres) lignes.push("Fiche " + nom + " modifiée");
    if (JSON.stringify(a.photos || []) !== JSON.stringify(p.photos)) lignes.push("Photos " + nom);
  });
  avant.forEach((a, id) => { if (!apres.has(id)) lignes.push("Suppression " + (a.nom || "Sans nom")); });
  const ac = ancien.config || {}, nc = nouveau.config;
  if (ac.whatsapp !== nc.whatsapp || ac.gmail !== nc.gmail) lignes.push("Coordonnées");
  if (ac.evenement !== nc.evenement || ac.evenementFin !== nc.evenementFin) lignes.push(nc.evenement ? "Événement " + nc.evenement : "Fin de l'événement");
  if (!lignes.length) return "Enregistrement sans changement";
  const tete = lignes.length > 4 ? lignes.slice(0, 3).join(" · ") + " et " + (lignes.length - 3) + " autres changements" : lignes.join(" · ");
  return tete.slice(0, 300);
}

/* Accès au dépôt GitHub */
function texteJson(o) { return JSON.stringify(o, null, 2) + "\n"; }
async function github(env, methode, chemin, corps) {
  const depot = env.GITHUB_REPO || "serthy666/saare-telecom";
  const r = await fetch("https://api.github.com/repos/" + depot + chemin, {
    method: methode,
    headers: {
      authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28", "user-agent": "saare-telecom-gerant",
      ...(corps ? { "content-type": "application/json" } : {})
    },
    body: corps ? JSON.stringify(corps) : undefined
  });
  if (r.status === 404 && methode === "GET") return null;
  if (r.status === 409 || r.status === 422) throw new Refus(409, "Un autre administrateur vient d'enregistrer. Rechargez le tableau de bord pour repartir de sa version.");
  if (r.status === 401 || r.status === 403) { console.log("GitHub refuse :", r.status, await r.text()); throw new Refus(502, "Le jeton GitHub de la boutique est refusé (expiré ?). Prévenez Serthy."); }
  if (!r.ok) { console.log("GitHub :", r.status, await r.text()); throw new Refus(502, "GitHub ne répond pas, réessayez dans un instant."); }
  return r.status === 204 ? null : r.json();
}
function branche(env) { return env.GITHUB_BRANCH || "main"; }
function decoder(base64) { return new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, "")), c => c.charCodeAt(0))); }
function encoder(texte) { let s = ""; for (const o of new TextEncoder().encode(texte)) s += String.fromCharCode(o); return btoa(s); }
async function lireFichier(env, chemin, ref) {
  const f = await github(env, "GET", "/contents/" + chemin + "?ref=" + encodeURIComponent(ref || branche(env)));
  return f ? { sha: f.sha, texte: decoder(f.content || "") } : null;
}
async function lireComptes(env) {
  const f = await lireFichier(env, FICHIER_COMPTES);
  let comptes = [];
  if (f) { try { comptes = JSON.parse(f.texte).comptes || []; } catch (e) { comptes = []; } }
  comptes = comptes.filter(c => c && c.email).map(c => ({ ...c, email: String(c.email).toLowerCase() }));
  return { comptes, sha: f ? f.sha : null };
}
async function ecrireFichier(env, chemin, texte, sha, message) {
  await github(env, "PUT", "/contents/" + chemin, { message, content: encoder(texte), branch: branche(env), ...(sha ? { sha } : {}) });
}
// Un commit qui regroupe plusieurs fichiers ; refusé si quelqu'un a écrit entre-temps
async function commiter(env, entrees, message) {
  const ref = await github(env, "GET", "/git/ref/heads/" + branche(env));
  const parent = ref.object.sha;
  const base = await github(env, "GET", "/git/commits/" + parent);
  const arbre = await github(env, "POST", "/git/trees", { base_tree: base.tree.sha, tree: entrees });
  const commit = await github(env, "POST", "/git/commits", { message, tree: arbre.sha, parents: [parent] });
  await github(env, "PATCH", "/git/refs/heads/" + branche(env), { sha: commit.sha, force: false });
  return commit.sha;
}
