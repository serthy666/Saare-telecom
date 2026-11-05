# Boutique BIMAK Store

Boutique en ligne de BIMAK Store (smartphones, tablettes, ordinateurs, accessoires, électroménager), en « verre liquide » blanc et jaune façon iPhone. Les clients commandent sur WhatsApp (+237 6 96 30 02 00). Le gérant remplit lui-même le catalogue depuis son téléphone, onglet **Gérant**.

Adresse : https://saare-telecom.apeledition.workers.dev (Worker Cloudflare ; `*.github.io` est bloqué chez Orange Cameroun).

## Côté clients

- Recherche sans accents, avec synonymes (« laptop », « telephone ») et budget (« 150000 », « 200k », « moins de 100 000 ») ; si rien ne correspond, un bouton envoie la demande au vendeur sur WhatsApp.
- Pas de panier : chaque article se commande directement par un message WhatsApp prêt à envoyer.
- Article « Épuisé » (réglé par le gérant) : le client touche « Me prévenir », un message prêt part vers le vendeur, et la boutique lui signale le retour de l'article à sa prochaine visite.
- Favoris, tri, articles similaires, « Vus récemment », bouton EN pour l'anglais.
- Partage d'un article par un lien `/p/nom-de-l-article-id` : WhatsApp et Facebook montrent sa photo, son nom et son prix dans l'aperçu, et la boutique ouvre sa fiche. Les anciens liens `#p=…` marchent toujours.

## Statistiques pour le vendeur (onglet Gérant)

- Visites, visiteurs, fiches vues et clics « Commander », sur aujourd'hui, 7 ou 30 jours, avec les visites jour par jour.
- Articles les plus regardés avec leur taux vue → clic « Commander », recherches qui n'ont rien trouvé, et d'où viennent les clients (statut WhatsApp, Facebook, TikTok, Instagram, Google, article partagé, lien direct).
- Liens suivis à copier (`/?s=statut`, `/?s=facebook`…) pour savoir quelle publication amène des commandes.
- Rien de personnel n'est gardé : seulement des compteurs par jour (ni adresse IP, ni numéro). Les appareils où un gérant s'est connecté ne sont pas comptés. Les robots d'aperçu (WhatsApp, Facebook) sont ignorés.
- Les compteurs sont dans une base Cloudflare D1 liée sous le nom `STATS` (`wrangler.jsonc`). Cloudflare crée la base « bimak-stats » toute seule à la publication, et la table se crée au premier passage. Sans base, la boutique marche normalement et l'onglet Statistiques le signale.
- Installable comme une appli (`manifest.webmanifest`, `sw.js`) : la boutique s'ouvre même avec un réseau faible.

## Comment ça marche

- `site/` est publié tel quel par Cloudflare Pages : `index.html`, `app.js`, `assets/`, les produits dans `site/donnees/produits.json` et les photos dans `site/photos/`.
- `functions/api/stats.js` reçoit les compteurs (`/api/stats`) ; `functions/p/[[chemin]].js` fabrique la page d'un article avec son aperçu (`/p/…`).
- `functions/api/gerant.js` est la fonction `/api/gerant` :
  1. vérifie le jeton de la connexion Google (Google Identity Services) ;
  2. accepte seulement le propriétaire (`PROPRIETAIRE`) et les Gmail de `site/donnees/comptes.json`, et ouvre une session de 8 heures ;
  3. « Enregistrer » écrit en **un seul commit** les produits et les nouvelles photos (réduites à 700 px par le téléphone), et retire les photos qui ne servent plus. Le message du commit dit qui a changé quoi, par exemple « Prix iPhone 11 : 150 000 → 135 000 (saaretelecom.shop@gmail.com) » ;
  4. seul le propriétaire invite ou retire un administrateur. Un invité passe de « Invité » à « Actif » à sa première connexion.
- Cloudflare republie le site en une minute environ après chaque commit. L'historique GitHub sert de journal : on peut annuler n'importe quel changement avec « Revert ».
- Si deux administrateurs enregistrent en même temps, le second est prévenu et recharge, au lieu d'écraser le premier.

Le dépôt est public : n'y mettez jamais de données de clients ni de secret. Le jeton GitHub reste dans les secrets Cloudflare.

## Réglages Cloudflare (Paramètres > Variables et secrets)

| Nom | Valeur | Type |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | identifiant du client OAuth Google (`…apps.googleusercontent.com`) | Texte |
| `PROPRIETAIRE` | `saaretelecom.shop@gmail.com` | Texte |
| `GITHUB_TOKEN` | jeton GitHub « fine-grained », dépôt `serthy666/saare-telecom` seulement, permission **Contents : Read and write** | Secret |
| `GITHUB_REPO` | facultatif, `serthy666/saare-telecom` par défaut | Texte |
| `GITHUB_BRANCH` | facultatif, `main` par défaut | Texte |

Deux façons de publier, le code marche avec les deux :

- **Worker Cloudflare** (Workers Builds, ce qui est branché aujourd'hui) : `wrangler.jsonc` sert `site/` et envoie `/api/gerant`, `/api/stats` et `/p/…` aux fonctions via `worker.js`. Les variables se règlent dans le Worker, onglet Settings > Variables and Secrets.
- **Cloudflare Pages** : framework **None**, commande de build vide, dossier de sortie **`site`** ; `functions/` est pris automatiquement.

Le client OAuth Google est de type « Application Web », avec `https://saare-telecom.apeledition.workers.dev` (et le domaine du client s'il en prend un) dans « Origines JavaScript autorisées ».

En secours : si le client perd son Gmail, changez `PROPRIETAIRE` dans Cloudflare puis republiez. Le jeton GitHub expire à la date choisie à sa création : il faut le renouveler avant (sinon le gérant voit « Le jeton GitHub de la boutique est refusé »).

## Tests

`node tests/parcours.mjs` (Playwright) fait tourner la vraie fonction avec un faux GitHub et une fausse connexion Google (`tests/serveur.mjs`), à 320, 390, 768 et 1280 px : boutique vide au départ, refus d'un compte non autorisé et d'un jeton d'un autre site, ajout de produits avec photo (appareil photo et galerie), promo refusée si plus chère, un seul commit par enregistrement, photo JPEG réduite dans le dépôt, vue client (prix barré, WhatsApp, fiche), promo de masse, invitation d'un vendeur (Invité puis Actif, sans droit d'inviter), conflit entre deux administrateurs, retrait d'un vendeur qui coupe sa session, suppression d'un produit et de ses photos, événement, fonction fermée sans session, recherche, absence de panier, article épuisé et rappel, favoris, anglais, lien partagé, appli installable, deux articles côte à côte sur téléphone, absence d'erreur et de défilement horizontal. Puis les statistiques avec une fausse base D1 (SQLite) : visite et source, fiche vue une fois par visite, clic Commander, recherche vide, lien d'article (aperçu, photo, fiche ouverte), robots et autres sites ignorés, tableau du gérant sur 7 et 30 jours, visites du gérant non comptées, boutique sans base.

`node tests/serveur.mjs` lance la même boutique de test sur http://localhost:8788.
