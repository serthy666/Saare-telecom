// Point d'entrée quand la boutique tourne comme Worker Cloudflare (Workers Builds) :
// /api/gerant, /api/stats et les liens d'article /p/… passent par les fonctions,
// tout le reste est servi depuis site/. Sur Cloudflare Pages, ce fichier est ignoré
// et functions/ prend le relais avec les mêmes fichiers.
import { onRequest as gerant } from "./functions/api/gerant.js";
import { onRequest as stats } from "./functions/api/stats.js";
import { onRequest as article } from "./functions/p/[[chemin]].js";

export default {
  async fetch(request, env, ctx) {
    const chemin = new URL(request.url).pathname;
    const contexte = { request, env, waitUntil: ctx.waitUntil.bind(ctx) };
    if (chemin === "/api/gerant") return gerant(contexte);
    if (chemin === "/api/stats") return stats(contexte);
    if (chemin.startsWith("/p/")) return article(contexte);
    return env.ASSETS.fetch(request);
  }
};
