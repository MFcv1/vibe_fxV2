import { redirect } from "next/navigation";
import StudioClient from "./StudioClient";

export const metadata = {
  title: "Studio",
  description: "Studio Vibe_fx V2 pour composer une image, preparer une publication et lancer la publication reseaux.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function StudioPage({ searchParams }) {
  const params = await searchParams;
  const requestedWorkspace = typeof params?.workspace === "string" ? params.workspace : "";

  /*
   * PHASE 7 (2026-08-01) - bascule vers le nouveau front VibeCut.
   *
   * `?workspace=video` ouvrait l'ancien editeur video, monte dans le shell du
   * studio. Cet editeur est supprime: la surface video vit desormais sur ses
   * propres routes, sous `/video`.
   *
   * La redirection est cote SERVEUR et permanente: les liens et favoris
   * existants continuent de fonctionner, et l'ancienne adresse ne rend jamais
   * une page vide le temps qu'un composant client decide de naviguer.
   */
  if (requestedWorkspace === "video") {
    redirect("/video");
  }

  const studioWorkspaces = new Set(["studio", "layout", "library", "soundtrack", "vision-pro"]);
  const initialWorkspace = studioWorkspaces.has(requestedWorkspace) ? requestedWorkspace : "layout";
  return (
    <StudioClient
      initialMode="layout"
      initialWorkspace={initialWorkspace}
    />
  );
}
