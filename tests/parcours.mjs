// Parcours complet de la boutique en ligne, sur téléphone et sur ordinateur, avec la vraie fonction gérant
// (GitHub et Google simulés par tests/serveur.mjs). Lancer : node tests/parcours.mjs
import { createRequire } from "node:module";
import { demarrer, PROPRIO, CLIENT_ID } from "./serveur.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

let ok = 0, ko = 0;
function verifie(cond, quoi) { if (cond) ok++; else { ko++; console.log("  ÉCHEC :", quoi); } }

// Fausse bibliothèque Google : un bouton, et window.__google(email) simule le choix du compte
const FAUX_GIS = `window.google={accounts:{id:{initialize:function(o){window.__cb=o.callback;window.__clientId=o.client_id},
  renderButton:function(el){var b=document.createElement("button");b.type="button";b.id="gis";b.textContent="Se connecter avec Google";el.appendChild(b)},
  disableAutoSelect:function(){}}}};window.__google=function(m,aud){window.__cb({credential:"test:"+m+(aud?"|"+aud:"")})};`;

// Petite image PNG de 900 x 600 générée dans le navigateur
async function image(p) {
  const b64 = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 900; c.height = 600; const x = c.getContext("2d"); x.fillStyle = "#2F6FDB"; x.fillRect(0, 0, 900, 600); x.fillStyle = "#E5382F"; x.fillRect(300, 100, 300, 400); return c.toDataURL("image/png").split(",")[1]; });
  return { name: "photo.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") };
}

async function page(nav, vue, s, erreurs) {
  const ctx = await nav.newContext({ viewport: vue, hasTouch: vue.width < 700, isMobile: vue.width < 700 });
  await ctx.route("https://accounts.google.com/gsi/client", r => r.fulfill({ contentType: "text/javascript", body: FAUX_GIS }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "" }));
  await ctx.route(/^https:\/\/wa\.me\//, r => r.fulfill({ contentType: "text/html", body: "WhatsApp" }));
  const p = await ctx.newPage();
  p.on("pageerror", e => erreurs.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/401|403|409|Failed to load resource/.test(m.text())) erreurs.push(m.text()); });
  p.on("dialog", d => d.accept());
  p.ctx = ctx;
  return p;
}
const largeur = p => p.evaluate(() => document.documentElement.scrollWidth);
const cartes = p => p.locator("#grille .produit").count();
const produitsDepot = s => JSON.parse(s.depot.lire("site/donnees/produits.json")).produits;
const comptesDepot = s => JSON.parse(s.depot.lire("site/donnees/comptes.json")).comptes;
async function connecter(p, s, email) {
  await p.goto(s.url + "/#admin");
  await p.locator("#gis").waitFor();
  await p.evaluate(m => window.__google(m), email);
}
// Ouvre la fiche d'un produit dans le tableau de bord et renvoie son numéro
async function ouvrir(p, nom) {
  const d = p.locator(".fiche-admin").filter({ has: p.locator("summary b", { hasText: nom }) }).first();
  if (!(await d.getAttribute("open") !== null)) await d.locator("summary").click();
  return d.getAttribute("data-i");
}
async function enregistrer(p) {
  await p.locator("#enregistrer").click();
  await p.waitForFunction(() => document.getElementById("sauvegarde").hidden || document.getElementById("sauvegarde").classList.contains("erreur-sv"));
}

async function parcours(nav, vue) {
  console.log("\n== " + vue.width + " px");
  const s = await demarrer();
  const erreurs = [];
  const p = await page(nav, vue, s, erreurs);

  // Boutique livrée vide
  await p.goto(s.url + "/"); await p.waitForTimeout(400);
  verifie(await cartes(p) === 0, "boutique vide au départ");
  verifie(/arrivent très bientôt/.test(await p.locator("#grille").textContent()), "message d'attente sur la boutique vide");
  verifie((await p.locator("#wa-flottant").getAttribute("href")).startsWith("https://wa.me/237696300200"), "WhatsApp du client");
  verifie((await p.locator("#wa-numero").textContent()) === "+237 6 96 30 02 00", "numéro affiché");
  verifie((await p.locator("#mail-adresse").textContent()) === PROPRIO, "Gmail affiché");
  verifie(await p.locator("#wa-a-remplir").isHidden() && await p.locator("#mail-a-remplir").isHidden(), "plus de mention « à fournir »");
  verifie(await largeur(p) <= vue.width, "pas de défilement horizontal (boutique)");

  // Gérant : bouton Google, refus, mauvais client OAuth, puis propriétaire
  await p.goto(s.url + "/#admin");
  await p.locator("#gis").waitFor();
  verifie(await p.evaluate(() => window.__clientId) === CLIENT_ID, "Google initialisé avec l'identifiant de la boutique");
  verifie(await p.locator("#vue-admin").isHidden(), "tableau de bord fermé sans connexion");
  await p.evaluate(() => window.__google("visiteur.curieux@gmail.com"));
  await p.locator("#refus").waitFor();
  verifie(/n'a pas accès/.test(await p.locator("#refus").textContent()) && await p.locator("#vue-admin").isHidden(), "compte non autorisé refusé");
  await p.evaluate(m => window.__google(m, "autre-site.apps.googleusercontent.com"), PROPRIO);
  await p.waitForFunction(() => /refusée/.test(document.getElementById("refus").textContent));
  verifie(await p.locator("#vue-admin").isHidden(), "jeton Google d'un autre site refusé");
  await p.evaluate(m => window.__google(m), PROPRIO);
  await p.locator("#tuiles .tuile").first().waitFor();
  verifie(await p.locator("#vue-admin").isVisible(), "propriétaire connecté");
  verifie(/propriétaire/.test(await p.locator("#qui").textContent()), "session du propriétaire");
  verifie((await p.locator('[data-tuile="tous"] b').textContent()) === "0", "tuile Toutes : 0");
  verifie(await p.locator("#sauvegarde").isHidden(), "rien à enregistrer au départ");
  verifie(await largeur(p) <= vue.width, "pas de défilement horizontal (tableau de bord)");

  // Ajout d'un téléphone avec photo prise à l'appareil
  await p.locator("#ajouter").click();
  await p.fill("#nom-0", "iPhone 13 Pro");
  await p.fill("#mar-0", "Apple");
  await p.fill("#det-0", "128 Go · bleu alpin");
  await p.fill("#gar-0", "12 mois");
  await p.fill("#prix-0", "300000");
  await p.locator("#cam-0").setInputFiles(await image(p));
  await p.waitForFunction(() => document.querySelectorAll('.fiche-admin[data-i="0"] .photos figure').length === 1);
  verifie(/1 changement à enregistrer/.test(await p.locator("#sv-texte").textContent()), "barre « 1 changement à enregistrer »");
  verifie(await largeur(p) <= vue.width, "pas de défilement horizontal (barre d'enregistrement)");
  await p.fill("#pp-0", "320000");
  verifie(/plus bas/.test(await p.locator("#ap-0").textContent()), "promo plus chère signalée");
  await p.locator("#enregistrer").click();
  verifie(/Corrigez/.test(await p.locator("#enregistre").textContent()) && s.depot.journal.length === 0, "promo plus chère : enregistrement bloqué");
  await p.fill("#pp-0", "285000");
  // Un ordinateur d'occasion, depuis la galerie
  await p.locator('[data-tuile="pc"]').click();
  await p.locator("#ajouter").click();
  const iPc = await p.locator(".fiche-admin[open]").getAttribute("data-i");
  await p.fill("#nom-" + iPc, "HP EliteBook 840 G6");
  await p.selectOption("#eta-" + iPc, "occasion");
  await p.fill("#prix-" + iPc, "185000");
  await p.locator("#ph-" + iPc).setInputFiles([await image(p), await image(p)]);
  await p.waitForFunction(i => document.querySelectorAll('.fiche-admin[data-i="' + i + '"] .photos figure').length === 2, iPc);
  verifie(/2 changements/.test(await p.locator("#sv-texte").textContent()), "barre « 2 changements »");
  await enregistrer(p);
  verifie(await p.locator("#sauvegarde").isHidden(), "enregistrement réussi");
  verifie(/Enregistré/.test(await p.locator("#enregistre").textContent()), "message « Enregistré »");
  let prods = produitsDepot(s);
  verifie(prods.length === 2, "2 produits écrits dans le dépôt (trouvé " + prods.length + ")");
  verifie(s.depot.journal.length === 1, "un seul commit pour tout l'enregistrement");
  verifie(/Ajout iPhone 13 Pro/.test(s.depot.journal[0]) && s.depot.journal[0].includes("(" + PROPRIO + ")"), "message du commit : qui a ajouté quoi (" + s.depot.journal[0] + ")");
  const iphone = prods.find(x => x.nom === "iPhone 13 Pro");
  verifie(iphone && iphone.prix === 300000 && iphone.prixPromo === 285000 && iphone.photos.length === 1, "iPhone : prix, promo et photo enregistrés");
  const fich = s.depot.fichiers();
  const photoIphone = iphone && fich.get("site/" + iphone.photos[0]);
  verifie(photoIphone && photoIphone[0] === 0xff && photoIphone[1] === 0xd8, "photo enregistrée en JPEG dans site/photos/");
  verifie(photoIphone && photoIphone.length < 200000, "photo réduite avant l'envoi (" + (photoIphone && photoIphone.length) + " octets)");
  verifie([...fich.keys()].filter(k => k.startsWith("site/photos/")).length === 3, "3 photos dans le dépôt");

  // Vue client, sans session
  const c = await page(nav, vue, s, erreurs);
  await c.goto(s.url + "/"); await c.waitForFunction(() => document.querySelectorAll("#grille .produit").length > 0);
  verifie(await cartes(c) === 2, "le client voit les 2 produits");
  const ordre = await c.evaluate(() => { const b = [...document.querySelectorAll(".produit")].find(x => x.querySelector(".prix s")); return b ? [...b.querySelector(".prix").children].map(k => k.tagName).join(",") : ""; });
  verifie(ordre === "S,B", "ancien prix barré au-dessus du vrai prix");
  const href = decodeURIComponent(await c.locator("#grille .produit", { hasText: "iPhone 13 Pro" }).locator(".commander").getAttribute("href")).replace(/\u00a0/g, " ");
  verifie(href.includes("wa.me/237696300200") && href.includes("iPhone 13 Pro") && href.includes("285 000 FCFA"), "commande WhatsApp avec produit et prix promo (" + href + ")");
  const img = c.locator("#grille .produit", { hasText: "iPhone 13 Pro" }).locator("img");
  await img.scrollIntoViewIfNeeded(); await c.waitForFunction(() => [...document.querySelectorAll("#grille img")].every(i => i.complete));
  verifie(await img.evaluate(i => i.naturalWidth === 700 && /^photos\//.test(i.getAttribute("src"))), "photo servie depuis le dépôt (700 px)");
  await c.locator('[data-rayon="pc"]').click();
  verifie(await cartes(c) === 1, "boutique Ordinateurs : 1");
  await c.locator('[data-fiche]').first().click();
  verifie(await c.locator(".fiche .galerie img").count() === 2, "fiche : 2 photos de l'ordinateur");
  await c.keyboard.press("Escape");
  verifie(await c.locator("#recents .mini").count() === 1, "« Vus récemment » après la fiche");
  await c.locator('[data-rayon="tous"]').click();

  // Deux articles côte à côte sur téléphone
  const hauts = await c.evaluate(() => [...document.querySelectorAll("#grille .produit")].map(x => Math.round(x.getBoundingClientRect().top)));
  if (vue.width < 760) verifie(hauts[0] === hauts[1], "2 articles côte à côte (" + hauts.join(",") + ")");
  verifie(await largeur(c) <= vue.width, "pas de défilement horizontal (grille)");

  // Recherche : synonymes, budget, demande au vendeur
  const cherche = async q => { await c.fill("#recherche", q); return cartes(c); };
  verifie(await cherche("hp") === 1 && await c.locator("#suggestions button[data-fiche]").count() === 1, "recherche « hp » : 1 article et 1 suggestion");
  verifie(await cherche("laptop") === 1, "recherche « laptop » trouve l'ordinateur");
  verifie(await cherche("telephone") === 1, "recherche sans accent « telephone »");
  verifie(await cherche("iphone 13") === 1, "recherche « iphone 13 »");
  verifie(await cherche("200k") === 1 && /200\u00a0000/.test(await c.locator("#budget").textContent()), "budget « 200k » : seulement l'ordinateur");
  verifie(await cherche("moins de 150 000") === 0, "budget « moins de 150 000 » : rien");
  await c.locator("#grille [data-demander]").click();
  const demandeHref = decodeURIComponent(await c.locator("#envoyer-alerte").getAttribute("href"));
  verifie(demandeHref.includes("wa.me/237696300200") && demandeHref.includes("moins de 150 000"), "demande au vendeur pour un article introuvable");
  await c.locator("#fermer").click();
  await c.locator("#effacer-recherche").click();
  verifie(await cartes(c) === 2, "recherche effacée");

  // Plus de panier : chaque carte commande directement sur WhatsApp
  verifie(await c.locator("#ouvrir-panier, [data-ajouter]").count() === 0, "pas de panier");
  verifie(await c.locator("#grille .produit .commander").count() === 2, "bouton WhatsApp sur chaque carte");

  // Favoris
  await c.locator("#grille .produit", { hasText: "HP EliteBook" }).locator("[data-coeur]").click();
  await c.locator('[data-f="favoris"]').click();
  verifie(await cartes(c) === 1, "filtre Favoris");
  await c.locator('[data-f="tous"]').click();

  // Anglais
  await c.locator("#langue").click();
  verifie(await c.evaluate(() => document.documentElement.lang) === "en" && /best phones/.test(await c.locator("h1").textContent()), "interface en anglais");
  const hrefEn = decodeURIComponent(await c.locator("#grille .produit", { hasText: "iPhone 13 Pro" }).locator(".commander").getAttribute("href"));
  verifie(hrefEn.includes("I would like to order") && await c.locator("#langue").textContent() === "FR", "commande WhatsApp en anglais");
  verifie(await largeur(c) <= vue.width, "pas de défilement horizontal (anglais)");
  await c.locator("#langue").click();
  verifie(/meilleurs téléphones/.test(await c.locator("h1").textContent()), "retour au français");

  // Lien partagé vers un produit, appli installable
  const idIphone = produitsDepot(s).find(x => x.nom === "iPhone 13 Pro").id;
  await c.goto(s.url + "/#p=" + idIphone); await c.locator(".fiche h3").waitFor();
  verifie(await c.locator(".fiche h3").textContent() === "iPhone 13 Pro", "lien partagé ouvre la fiche");
  await c.keyboard.press("Escape");
  const man = await c.evaluate(() => fetch("/manifest.webmanifest").then(r => r.json()));
  verifie(man.display === "standalone" && man.icons.length === 3, "manifeste de l'appli");
  verifie(await c.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active)), "service worker actif");

  // Promotion de masse : ordinateurs d'occasion -15 %
  await p.selectOption("#pr-rayon", "pc"); await p.selectOption("#pr-etat", "occasion");
  await p.fill("#pr-remise", "15");
  await p.locator("#pr-lancer").click();
  verifie(/touchez « Enregistrer »/.test(await p.locator("#enregistre").textContent()), "promo de masse prête à enregistrer");
  await enregistrer(p);
  prods = produitsDepot(s);
  verifie(prods.find(x => x.nom.startsWith("HP")).prixPromo === 157500, "promo -15 % écrite (157 500)");
  verifie(/Promo HP EliteBook 840 G6/.test(s.depot.journal.at(-1)), "commit de promo : " + s.depot.journal.at(-1));

  // Article épuisé : le client demande à être prévenu, puis l'article revient
  const iE = await ouvrir(p, "HP EliteBook");
  await p.selectOption("#stk-" + iE, "epuise");
  await enregistrer(p);
  verifie(produitsDepot(s).find(x => x.nom.startsWith("HP")).stock === "epuise", "stock « épuisé » écrit dans le dépôt");
  await c.goto(s.url + "/"); await c.waitForFunction(() => document.querySelectorAll("#grille .produit").length > 0);
  const hp = c.locator("#grille .produit", { hasText: "HP EliteBook" });
  verifie(await hp.locator(".badge.epuise").count() === 1 && await hp.locator(".commander").count() === 0, "carte épuisée : badge, pas de commande");
  verifie(await c.locator("#grille .produit").last().textContent().then(t => t.includes("HP")), "article épuisé en fin de liste");
  await hp.locator("[data-prevenir]").click();
  const alerte = decodeURIComponent(await c.locator("#envoyer-alerte").getAttribute("href"));
  verifie(alerte.includes("prévenir") && alerte.includes("HP EliteBook 840 G6"), "demande de rappel au vendeur");
  await c.locator("#envoyer-alerte").click();
  await c.waitForFunction(() => document.getElementById("voile").hidden);
  verifie(await hp.locator(".prevenir.fait").count() === 1, "« Demandé » sur la carte");
  await p.selectOption("#stk-" + iE, "ok");
  await enregistrer(p);
  await c.reload(); await c.waitForFunction(() => /de retour/.test(document.getElementById("toast").textContent));
  verifie(true, "le client est prévenu du retour de l'article");

  // Invitation d'un vendeur
  verifie(await p.locator("#zone-ajout-compte").isVisible(), "le propriétaire peut inviter");
  await p.fill("#nouveau-compte", "pas-une-adresse");
  await p.locator("#ajouter-compte").click();
  verifie(await p.locator("#erreur-compte").isVisible(), "adresse non Gmail refusée");
  await p.fill("#nouveau-compte", "Vendeur.Saare@gmail.com");
  await p.locator("#ajouter-compte").click();
  await p.locator("#invitation").waitFor();
  verifie(comptesDepot(s).some(x => x.email === "vendeur.saare@gmail.com" && x.statut === "invite"), "vendeur ajouté au dépôt avec le statut Invité");
  verifie(/Invité/.test(await p.locator("#comptes").textContent()), "statut « Invité » affiché");
  verifie((await p.locator("#invit-wa").getAttribute("href")).startsWith("https://wa.me/?text="), "invitation prête pour WhatsApp");
  verifie((await p.locator("#texte-invit").textContent()).includes(s.url + "/#admin"), "invitation avec le lien de la boutique");

  // Le vendeur se connecte : il devient Actif, gère les produits, mais n'invite personne
  const v = await page(nav, vue, s, erreurs);
  await connecter(v, s, "vendeur.saare@gmail.com");
  await v.locator("#tuiles .tuile").first().waitFor();
  verifie(comptesDepot(s).find(x => x.email === "vendeur.saare@gmail.com").statut === "actif", "vendeur passé à Actif à sa première connexion");
  verifie(await v.locator("#zone-ajout-compte").isHidden() && await v.locator("#note-comptes").isVisible(), "le vendeur ne peut pas inviter");
  verifie(await v.locator("[data-retirer-compte]").count() === 0, "le vendeur ne peut retirer personne");
  const refusApi = await v.evaluate(async () => { const g = JSON.parse(sessionStorage.getItem("saare-gerant")); const r = await fetch("/api/gerant", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + g.jeton }, body: JSON.stringify({ action: "inviter", email: "pirate@gmail.com" }) }); return r.status; });
  verifie(refusApi === 403, "la fonction refuse une invitation par le vendeur (" + refusApi + ")");
  const iV = await ouvrir(v, "iPhone 13 Pro");
  await v.fill("#prix-" + iV, "310000");
  await enregistrer(v);
  verifie(/Prix iPhone 13 Pro : 300 000 → 310 000 \(vendeur\.saare@gmail\.com\)/.test(s.depot.journal.at(-1)), "commit du vendeur : " + s.depot.journal.at(-1));

  // Conflit : le propriétaire enregistre par-dessus une version dépassée
  await p.locator('[data-tuile="tous"]').click();
  const iP = await ouvrir(p, "iPhone 13 Pro");
  await p.fill("#gar-" + iP, "6 mois");
  const avant = s.depot.journal.length;
  await enregistrer(p);
  verifie(s.depot.journal.length === avant, "pas d'écrasement des changements du vendeur");
  verifie(/Rechargez/.test(await p.locator("#enregistre").textContent()), "conflit expliqué au propriétaire");
  await p.locator("#annuler").click();
  await p.reload(); await p.locator("#tuiles .tuile").first().waitFor();
  verifie(/310\u00a0000/.test(await p.locator("#admin-liste").textContent()), "après rechargement, le propriétaire voit le prix du vendeur (" + await p.locator("#admin-liste").textContent() + ")");

  // Retrait du vendeur : sa session ne marche plus
  await p.locator('[data-retirer-compte="vendeur.saare@gmail.com"]').click();
  await p.locator('[data-retirer-compte="vendeur.saare@gmail.com"]').click();
  await p.waitForFunction(() => !document.querySelector("[data-retirer-compte]"));
  verifie(comptesDepot(s).length === 0, "vendeur retiré du dépôt");
  await v.fill("#prix-" + iV, "305000");
  await v.locator("#enregistrer").click();
  await v.locator("#vue-connexion").waitFor({ state: "visible" });
  verifie(/plus accès/.test(await v.locator("#refus").textContent()), "vendeur retiré renvoyé à la connexion");

  // Suppression d'un produit : sa photo quitte le dépôt
  const nomS = "HP EliteBook 840 G6";
  const iS = await ouvrir(p, nomS);
  await p.locator('[data-supprimer="' + iS + '"]').click();
  await p.locator('[data-supprimer="' + iS + '"]').click();
  await enregistrer(p);
  prods = produitsDepot(s);
  verifie(prods.length === 1 && !prods.some(x => x.nom === nomS), "produit supprimé du dépôt");
  const restantes = [...s.depot.fichiers().keys()].filter(k => k.startsWith("site/photos/"));
  verifie(restantes.length === prods[0].photos.length, "photos du produit supprimé retirées du dépôt (" + restantes.length + ")");
  verifie(/Suppression/.test(s.depot.journal.at(-1)), "commit de suppression");

  // Événement Black Friday et coordonnées
  await p.selectOption("#cfg-ev", "Black Friday");
  await enregistrer(p);
  verifie(JSON.parse(s.depot.lire("site/donnees/produits.json")).config.evenement === "Black Friday", "événement enregistré");
  await c.reload(); await c.waitForTimeout(500);
  verifie(await c.locator("#evenement").isVisible(), "bandeau d'événement chez le client");

  // Sécurité de la fonction
  const api = await c.evaluate(async () => {
    const post = (b, h) => fetch("/api/gerant", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, h || {}), body: JSON.stringify(b) }).then(r => r.status);
    return [
      await post({ action: "enregistrer", donnees: { config: {}, produits: [] } }),
      await post({ action: "enregistrer", donnees: { config: {}, produits: [] } }, { authorization: "Bearer eyJlIjoic2FhcmV0ZWxlY29tLnNob3BAZ21haWwuY29tIiwieCI6OTk5OTk5OTk5OX0.faux" }),
      await fetch("/api/gerant?action=donnees").then(r => r.status),
      await post({ action: "connexion", credential: "n'importe quoi" })
    ];
  });
  verifie(api.join() === "401,401,401,401", "fonction fermée sans session valide (" + api.join() + ")");
  verifie(produitsDepot(s).length === 1, "rien d'effacé par les appels refusés");

  // Déconnexion
  await p.locator("#deconnexion").click();
  verifie(await p.locator("#vue-connexion").isVisible(), "déconnexion");

  verifie(erreurs.length === 0, "aucune erreur JavaScript (" + erreurs.join(" | ") + ")");
  for (const x of [p, c, v]) await x.ctx.close();
  await s.arreter();
}

const nav = await chromium.launch();
for (const vue of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) await parcours(nav, vue);

// Fonction non configurée : la page le dit au lieu de planter
{
  const s = await demarrer({ env: { GOOGLE_CLIENT_ID: "" } });
  const erreurs = [];
  const p = await page(nav, { width: 390, height: 844 }, s, erreurs);
  await p.goto(s.url + "/#admin");
  await p.waitForFunction(() => /pas encore configuré/.test(document.getElementById("google-attente")?.textContent || ""));
  verifie(true, "message si la connexion Google n'est pas configurée");
  await p.ctx.close(); await s.arreter();
}
await nav.close();
console.log("\n" + ok + " vérifications réussies, " + ko + " échec(s).");
process.exit(ko ? 1 : 0);
