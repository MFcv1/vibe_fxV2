# VibeCut Cloud Run Jobs — MVP CPU/GPU

Cette cible remplace le service HTTP long-lived par des jobs FFmpeg privés et bornés.

- `cpu-standard`: 4 vCPU, 8 Gio, clips sociaux simples.
- `cpu-pro60`: 8 vCPU, 16 Gio, 60 fps, plus de 5 minutes, résolution supérieure à 1080p ou timeline dense.
- timeout: 2 heures, aucun retry Cloud Run automatique, une tâche par export.
- orchestration: callable Firebase → Cloud Tasks → API Cloud Run Jobs → worker → Firebase Storage/Firestore.
- annulation: le document est marqué immédiatement, puis l’exécution Cloud Run est annulée si son nom est déjà connu.

## Préparation IAM

Créer ou choisir un compte de service de rendu avec accès minimal au bucket source/output et à la collection `videoExportJobs`.

Le compte d’exécution des Functions doit pouvoir:

- lancer `vibecut-render-cpu-standard` et `vibecut-render-cpu-pro60`;
- annuler leurs exécutions;
- envoyer dans la file Cloud Tasks existante.

Le compte de rendu doit pouvoir:

- lire `users/*/sources/**` et les manifests;
- écrire `users/*/exports/**`;
- lire et mettre à jour `videoExportJobs/{jobId}`.

## Déploiement

Le script est sans effet par défaut:

```bash
infra/vibecut-cloud-run-jobs/deploy.sh PROJECT_ID RENDER_SERVICE_ACCOUNT
```

Après revue du projet et du compte de service:

```bash
infra/vibecut-cloud-run-jobs/deploy.sh PROJECT_ID RENDER_SERVICE_ACCOUNT --apply
```

Configurer ensuite les Functions:

```text
EXPORT_RENDER_ORCHESTRATION=cloudrunjobs
EXPORT_RENDERER_PROJECT_ID=<project>
EXPORT_RENDERER_JOBS_REGION=europe-west1
EXPORT_GPU_ENABLED=false
```

Le GPU reste désactivé jusqu’à validation des quotas et du benchmark qualité/coût.

## État live au 29 juillet 2026

- Functions, jobs CPU/GPU et service de téléchargement : Node.js 22.
- `cpu-standard`, `cpu-pro60` et `gpu-turbo` sont déployés en `europe-west1`.
- Le routeur reste sur `cpu-pro60` pour le 1080p60.
- Benchmark identique de 15,5 s : CPU Pro 76,058 s et 34,2 Mo ; GPU L4 95,310 s et 67,3 Mo.
- Conclusion : le L4 est environ 25 % plus lent et produit un fichier environ deux fois plus lourd sur le graphe actuel. `EXPORT_GPU_ENABLED=false` doit rester en place.
- Le téléchargement passe par `vibecut-download-service`, avec jeton HMAC court, revalidation Firestore et streaming Storage. L'ancienne Function limitée à 32 Mio a été supprimée.

## Profil GPU expérimental

`deploy-gpu.sh` prépare un job NVIDIA L4 (8 vCPU, 32 Gio, NVENC H.264). Même avec
`--apply`, il refuse de déployer sans `VIBECUT_ENABLE_GPU_DEPLOY=true`.

Le GPU n'accélère ici que l'encodage final : les filtres, transitions et compositions
FFmpeg restent majoritairement CPU. Il ne doit être réactivé en production que si le
corpus 5/10/15 minutes démontre un meilleur temps total et un coût acceptable:

```bash
infra/vibecut-cloud-run-jobs/deploy-gpu.sh PROJECT_ID RENDER_SERVICE_ACCOUNT
VIBECUT_ENABLE_GPU_DEPLOY=true \
  infra/vibecut-cloud-run-jobs/deploy-gpu.sh PROJECT_ID RENDER_SERVICE_ACCOUNT --apply
```
