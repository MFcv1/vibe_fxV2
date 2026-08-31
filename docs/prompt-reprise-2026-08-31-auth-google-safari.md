# Reprise — connexion Google Safari — 2026-08-31

Projet : `/Users/matthis/Desktop/mes projets mac/vibe_fxV2`.

Lire `AGENTS.md`, le début de `todo.md`, puis seulement les zones Auth de
`plan.md` et `map.md`. Ne pas ouvrir les archives ni les anciens prompts.

## Diagnostic et correction

Dans Safari, le popup Firebase s'ouvrait sur `vibefx-v2.firebaseapp.com` puis
échouait avant Google. Son fragment `fac` contenait `UNKNOWN_ERROR` : App Check
ne pouvait pas produire son jeton, car la clé reCAPTCHA `vibefx-v2-web`
n'autorisait pas le domaine App Hosting live.

Le domaine suivant a été ajouté à la liste exacte de la clé, sans
`allow-all-domains` :

`vibefx-v2-web--vibefx-v2.europe-west4.hosted.app`

Le premier popup restait ensuite sensible au bloqueur Safari, car Firebase
initialisait son resolver après le clic. `src/context/AuthContext.jsx` prépare
désormais ce resolver au montage avec `getRedirectResult(auth)` et expose
`googleAuthReady`. `src/components/StudioAuthGate.jsx` garde le bouton Google
désactivé jusque-là et affiche les codes d'erreur utiles.

Le flux reste `signInWithPopup`. App Check n'a pas été désactivé et aucun
réglage Safari n'a été contourné.

## Gates

- smoke Vision/Studio ciblé : 1/1 ;
- lint : zéro erreur, cinq avertissements préexistants ;
- build Node 22 : vert, avertissement NFT préexistant.

## À préserver

- Garder le domaine App Hosting dans les domaines reCAPTCHA autorisés.
- Préparer le resolver avant d'activer le bouton Google.
- Ne pas remplacer ce correctif par une redirection cross-origin sans suivre
  les recommandations Firebase pour Safari et le stockage tiers.
- Ne jamais masquer à nouveau tous les codes Firebase derrière une erreur
  générique.
