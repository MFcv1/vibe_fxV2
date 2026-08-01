# AGENTS.md - Vibe_fx V2

## Priorite de lecture

Tout agent IA doit lire ces fichiers dans cet ordre avant de modifier le projet :

1. `AGENTS.md` - regles de travail, contraintes et liens vers les docs.
2. `plan.md` - plan de la reconstruction VibeCut en cours : diagnostic, architecture, direction artistique detaillee, phases et rituel de fin de phase.
3. `todo.md` - etat d'avancement de cette reconstruction, bugs connus et prompt de relance.
4. `map.md` - carte vivante du projet, a tenir a jour.
5. `seo.md` - strategie SEO Google, gates de validation et sources officielles.
6. `MEGAPROMPT.md` - prompt maitre de conception pour lancer la vraie construction.
7. Les skills utiles dans `.agents/skills/`, surtout `cyber-neon`, `dark-ui`, `technical-ui` et `motion`.

## Intention produit

Vibe_fx V2 est un nouveau projet independant, cree dans `C:\Users\matth\Travail\vibe_fxV2`, a partir de l'analyse de `C:\Users\matth\Desktop\jardin de chawi` sans modifier le projet source.

Le produit cible est un outil web public permettant :

- de creer et modifier des images sociales dans une page "mise en page" ;
- d'importer le rendu vers une page publication ;
- de finaliser titre, caption, image, formats sociaux et statut ;
- de publier sur le site et vers Instagram/Facebook via Meta OAuth ;
- de limiter le stockage de donnees au strict necessaire au depart.

## Regles de modification

- Ne jamais modifier le projet source `C:\Users\matth\Desktop\jardin de chawi`.
- Ne pas toucher aux dossiers `node_modules/`, `.next/`, `.git/`, `dist/`.
- Mettre a jour `map.md` a chaque creation, suppression, renommage, deplacement ou modification structurelle.
- Les images statiques vont dans `public/assets/`.
- Les uploads utilisateurs doivent passer par Firebase Storage.
- Les secrets Meta/Firebase ne doivent jamais etre hardcodes.
- Les parcours OAuth, publication reseaux, chiffrement token et anti-doublon restent cote serveur Firebase Functions.
- Les pages publiques doivent etre indexables ; les surfaces studio/app privees doivent etre `noindex`.

## Rituel de fin de phase (reconstruction VibeCut)

A la fin de chaque grande phase et de chaque module livre, avant de passer a la suite :

- Verifier : `npm run lint`, `npm run build`, la suite de tests du nouveau front et les suites impactees.
- Mettre a jour `todo.md` (fait, reste, bugs trouves et corriges, problemes connus).
- Mettre a jour `plan.md` (phase marquee terminee, phases suivantes ajustees).
- Mettre a jour `map.md` (arborescence + entree de journal datee).
- Ecrire un prompt de relance en fin de `todo.md` pour repartir dans un chat neuf sans rien relire.
- Rapporter honnetement ce qui marche, ce qui est laisse de cote et pourquoi, et les echecs de tests preexistants.

## Discipline de deploiement et couts

Les deploiements Firebase App Hosting, Cloud Run et Functions peuvent declencher Cloud Build, Artifact Registry et des couts de build/deploiement. Les agents doivent donc eviter les rollouts excessifs.

- Developper et verifier en local d'abord : `npm run dev`, tests smoke, lint et build local.
- Ne deployer que lorsqu'un lot coherent de changements est pret ou quand l'utilisateur demande explicitement une mise en hosting.
- Grouper les petites corrections au lieu d'enchainer des rollouts successifs.
- Avant tout deploy hosting, executer au minimum les gates adaptes au changement : `npm run lint`, `npm run build`, tests smoke concernes, et `npm --prefix functions run lint` si Functions change.
- Eviter `gcloud run deploy --source` pour des tests frequents du renderer : le deploy depuis source utilise Cloud Build/buildpacks et peut ajouter des couts de build.
- Pour `render-service/`, redeployer seulement quand le renderer change vraiment ; si plusieurs essais sont necessaires, preferer construire une image versionnee une fois puis redeployer cette image.
- Ne jamais deployer pour "voir si ca marche" quand une verification locale ou un test cible peut attraper le probleme.
- Apres un deploy, verifier l'URL live et noter le commit/rollout dans la reponse utilisateur.

## Telemetry couts cible

Le backoffice doit distinguer trois sources, sans afficher des zeros trompeurs :

- Estimation live interne : ecrite a chaque job/export depuis le serveur, basee sur duree reelle, CPU/memoire configurees, requetes, taille output et statut. C'est la source temps quasi reel pour detecter surcharge et abus.
- Usage Cloud Run/Monitoring : source operationnelle pour confirmer activite, latence, instances, erreurs et requetes, mais pas une facture euro instantanee.
- Facture Google officielle : Cloud Billing Export BigQuery, differree et sujette aux free tiers/credits/arrondis. Elle sert a comparer et calibrer l'estimation interne, pas a piloter le temps reel.

Pour Vibe_CUT, chaque export serveur doit creer/mettre a jour un `videoExportJobs/{jobId}` avec `startedAt`, `endedAt`, duree rendu, service Cloud Run, region, CPU, memoire, input/output bytes, statut, estimation brute, user/dev et metadonnees video. Les tests directs K1 qui appellent Cloud Run hors workflow doivent aussi produire un evenement de telemetry ou etre clairement marques comme "hors jobs Firestore".

## Architecture cible choisie

Choix principal : Next.js App Router + Firebase App Hosting.

Raison : le besoin de referencement maximal exclut un SPA pur pour les pages marketing et ressources SEO. Next.js permet SSG/SSR/metadata/sitemap/robots/structured data, tandis que l'editeur image reste un client component isole. Firebase App Hosting supporte officiellement Next.js et s'integre a Auth, Firestore, Storage, Functions et Secret Manager.

## Design system cible

Ne pas reprendre la pate graphique de Jardin de Chawi.

- Direction principale : `cyber-neon` pour la marque et les pages publiques.
- Direction produit : `dark-ui` pour les surfaces de travail longues.
- Direction workflow : `technical-ui` pour les panneaux, statuts, logs, tables et controles.
- Contrainte forte : ne pas casser la structure responsive existante de la page mise en page ; changer l'UI et les tokens, pas l'ergonomie deja validee.

## Code importe a auditer avant construction

Le projet contient deja des copies de reference issues du projet source :

- `src/features/vibefx-layout/` : moteur et UI de la page mise en page.
- `src/features/publications/PublicationsManager.jsx` : studio publications + route import vers publication + boutons Meta.
- `functions/` : base Functions copiee, a reduire au strict necessaire Vibe_fx V2 avant deploy.
- `public/assets/vibefx/demo-astronaut.png` : image demo.

Ces copies sont des materiaux de depart, pas une architecture finale validee.

Important : le moteur publication/Firebase du projet source est une base a conserver. Les prochains agents doivent porter et generaliser la logique deja faite dans Jardin de Chawi : publication manager, route mise en page vers publication, uploads Storage, callables Meta OAuth, locks anti-doublon, statuts plateforme et regles Firestore/Storage. Il ne faut pas reconstruire cette logique de zero sauf si une partie est explicitement invalide pour le modele multi-utilisateur Vibe_fx V2.

## Gates avant toute vraie implementation

- Lire `MEGAPROMPT.md` et suivre son ordre.
- Faire un audit des imports existants.
- Decouper `PublicationsManager.jsx` en modules propres avant d'ajouter des features.
- Extraire les fonctions Firebase inutiles au produit Vibe_fx V2.
- Verifier `npm run lint`, `npm run build`, et `npm --prefix functions run lint`.
- Valider SEO : metadata, canonical, sitemap, robots, structured data, rendu HTML sans JS pour pages publiques.
