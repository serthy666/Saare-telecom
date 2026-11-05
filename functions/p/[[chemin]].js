// Lien d'un article (adresse /p/iphone-15-pro-pmvt11wdv9mfh) : la même page que la boutique,
// mais avec le nom, le prix et la photo de l'article dans l'aperçu que montrent WhatsApp et Facebook.
// La boutique ouvre ensuite la fiche de l'article toute seule.

const ID = /^[a-z0-9]{1,40}$/;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const segment = decodeURIComponent(url.pathname.replace(/^\/p\//, "").split("/")[0] || "").toLowerCase();
  const id = segment.split("-").pop();
  const lire = chemin => env.ASSETS.fetch(new Request(new URL(chemin, url.origin)));
  if (!ID.test(id)) return Response.redirect(url.origin + "/", 302);
  const [rPage, rDonnees] = await Promise.all([lire("/"), lire("/donnees/produits.json")]);
  if (!rPage.ok) return rPage;
  let page = await rPage.text(), donnees = null;
  try { donnees = rDonnees.ok ? await rDonnees.json() : null; } catch (e) { donnees = null; }
  const p = donnees && Array.isArray(donnees.produits) ? donnees.produits.find(x => x && x.id === id && x.visible !== false) : null;
  if (!p) return Response.redirect(url.origin + "/", 302);

  const prix = prixTexte(p, donnees.config || {});
  const titre = p.nom + (prix ? " · " + prix : "") + " | BIMAK Store";
  const etat = { neuf: "Neuf", occasion: "Occasion", pieces: "Pièces détachées" }[p.etat] || "";
  const description = [etat, p.details, p.stock === "epuise" ? "Épuisé pour le moment" : "Commandez sur WhatsApp"].filter(Boolean).join(" · ");
  const photo = Array.isArray(p.photos) && /^photos\/[a-z0-9-]{1,80}\.(jpg|webp|png)$/.test(p.photos[0] || "") ? url.origin + "/" + p.photos[0] : url.origin + "/assets/accueil.webp";
  const canonique = url.origin + url.pathname;

  // Les liens de la page sont relatifs (app.js, assets/…) : <base> les fait partir de la racine
  page = page.replace(/<meta charset="utf-8">/i, m => m + '\n<base href="/">')
    .replace(/<title>[^<]*<\/title>/i, "<title>" + esc(titre) + "</title>")
    .replace(/(<meta name="description" content=")[^"]*(")/i, "$1" + esc(description) + "$2")
    .replace(/(<meta property="og:title" content=")[^"]*(")/i, "$1" + esc(p.nom + (prix ? " · " + prix : "")) + "$2")
    .replace(/(<meta property="og:description" content=")[^"]*(")/i, "$1" + esc(description) + "$2")
    .replace(/(<meta property="og:image" content=")[^"]*(")/i, "$1" + esc(photo) + "$2")
    .replace(/<\/head>/i, '<meta property="og:url" content="' + esc(canonique) + '">\n<meta property="og:type" content="product">\n<link rel="canonical" href="' + esc(canonique) + '">\n</head>');
  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" } });
}

// Même règle que la boutique : la promo compte si elle est moins chère et pas terminée
function prixTexte(p, config) {
  const prix = Number(p.prix) || 0, promo = Number(p.prixPromo) || 0;
  if (!prix) return "";
  let enPromo = promo > 0 && promo < prix;
  if (enPromo && p.offre === "flash" && p.fin && new Date(p.fin + "+01:00") < new Date()) enPromo = false;
  if (enPromo && p.offre === "bf" && !config.evenement) enPromo = false;
  return fcfa(enPromo ? promo : prix);
}
function fcfa(n) { return Math.round(n).toLocaleString("fr-FR").replace(/[\s  ]/g, " ") + " FCFA"; }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
