import { redirect } from "next/navigation";

export const metadata = {
  title: "Studio",
  robots: {
    index: false,
    follow: false,
  },
};

/*
 * PHASE F (2026-08-08) - bascule vers VibeOS.
 *
 * L'interface de creation vit desormais sur `/creer/*` (plan §4.4). `/studio`
 * ne rend plus rien: il redirige cote SERVEUR, en conservant l'espace demande
 * par l'ancien parametre `?workspace=`. Les liens, favoris et pages publiques
 * qui pointent encore vers `/studio` continuent donc de tomber au bon endroit.
 *
 * La publication, elle, a sa propre route: `/publier`.
 */
const WORKSPACE_ROUTES = {
  layout: "/creer/layout-visuel",
  studio: "/creer/studio",
  "vision-pro": "/creer/vision",
  soundtrack: "/creer/son",
  /* L'onglet « library » de l'ancien studio n'a pas d'equivalent: la
     bibliotheque musicale est dans Soundtrack. */
  library: "/creer/son",
  /* Phase 7: la surface video a ses propres routes. */
  video: "/video",
};

export default async function StudioPage({ searchParams }) {
  const params = await searchParams;
  const requestedWorkspace = typeof params?.workspace === "string" ? params.workspace : "";
  redirect(WORKSPACE_ROUTES[requestedWorkspace] || "/creer");
}
