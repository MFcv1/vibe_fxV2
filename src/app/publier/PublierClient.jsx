"use client";

import { useEffect, useState } from "react";
import PublicationsManager from "@/features/publications/PublicationsManager";
import StudioAuthGate from "@/components/StudioAuthGate";
import { takePendingPublication } from "@/features/vibeos/project/publishHandoff";

/*
 * Le bouton « Publier » de VibeOS rend le projet puis depose la charge utile
 * dans le relais (`publishHandoff`). On la reprend ICI, une seule fois, au
 * montage - jamais pendant le rendu, pour ne pas la consommer deux fois en
 * mode strict.
 *
 * Sans relais (acces direct a /publier, ou rechargement de la page), la page
 * ouvre simplement le hall des publications: c'est le comportement de l'ancien
 * /studio en mode publication.
 */
export default function PublierClient() {
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);

  /* Micro-tache (meme motif que les ecrans VibeOS): on ne pose pas d'etat dans
     le corps de l'effet, pour eviter un rendu en cascade au montage. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraft(takePendingPublication());
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <StudioAuthGate>
      <PublicationsManager
        initialMode="publish"
        initialDraft={draft}
        layoutHref="/creer/layout-visuel"
      />
    </StudioAuthGate>
  );
}
