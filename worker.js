// Point d'entrée quand la boutique tourne comme Worker Cloudflare (Workers Builds) :
// /api/gerant passe par la fonction gérant, tout le reste est servi depuis site/.
// Sur Cloudflare Pages, ce fichier est ignoré et functions/ prend le relais.
import { onRequest } from "./functions/api/gerant.js";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/gerant") return onRequest({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
    return env.ASSETS.fetch(request);
  }
};
