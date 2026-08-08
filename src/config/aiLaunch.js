export const AI_INTERFACES_STORAGE_KEY = "vibefx.aiInterfacesEnabled";
export const AI_INTERFACES_COOKIE_NAME = "vibefx_ai_interfaces";
export const AI_INTERFACES_CHANGE_EVENT = "vibefx:ai-interfaces-change";

export const AI_INTERFACES_DEFAULT_ENABLED =
  process.env.NEXT_PUBLIC_VIBEFX_AI_INTERFACES_ENABLED === "true";

export const AI_FRONT_SURFACES = [
  {
    id: "home-pricing-cta",
    zone: "Public",
    route: "/",
    surface: "CTA credits IA",
    disabledState: "Remplace par un lien tarifs neutre.",
  },
  {
    id: "pricing-credit-products",
    zone: "Public",
    route: "/pricing",
    surface: "Offres credits IA et tokenomics",
    disabledState: "Garde seulement l'offre premium non IA.",
  },
  {
    id: "account-usage-ai",
    zone: "Compte",
    route: "/account/usage",
    surface: "Formulaire createAiJob + historique aiJobs",
    disabledState: "Affiche un etat de lancement sans controle IA.",
  },
  {
    id: "account-billing-credit-packs",
    zone: "Compte",
    route: "/account/billing",
    surface: "Packs credits IA",
    disabledState: "Masque les packs credits IA.",
  },
  /*
   * PHASE F (2026-08-08): l'ancienne interface /studio a ete supprimee avec la
   * bascule vers VibeOS. Le rail agents IA et l'onglet bibliotheque Midjourney
   * vivaient DEDANS: ces deux surfaces front n'existent plus tant qu'elles ne
   * sont pas portees dans /creer. Les routes API et le ledger IA, eux, sont
   * intacts (voir les entrees "API Next" plus bas).
   */
  {
    id: "studio-ai-rail",
    zone: "Creation",
    route: "/creer",
    surface: "Rail agents IA contextuel (a porter dans VibeOS)",
    disabledState: "Surface absente depuis la bascule VibeOS.",
  },
  {
    id: "midjourney-asset-library",
    zone: "Creation",
    route: "/creer",
    surface: "Bibliotheque assets Midjourney/scraper (a porter dans VibeOS)",
    disabledState: "Surface absente depuis la bascule VibeOS.",
  },
  {
    id: "video-ai-clip",
    zone: "Studio video",
    // Phase 7: VibeCut a ses propres routes; /studio?workspace=video redirige.
    route: "/video",
    surface: "Boutons AI clip + rail agent video",
    disabledState: "Boutons et rail IA video non montes.",
  },
  {
    id: "soundtrack-ai-providers",
    zone: "Soundtrack",
    route: "/creer/son",
    surface: "Providers de generation musicale IA",
    disabledState: "Catalogue limite aux sources non IA.",
  },
  {
    id: "music-ai-api",
    zone: "API Next",
    route: "/api/music/ai-*",
    surface: "Routes generation/import/providers IA musique",
    disabledState: "Retourne 404 tant que le flag prod est off.",
  },
];

export const AI_PROVIDER_IDS = new Set([
  "minimax-music",
  "mureka",
  "replicate-music",
  "elevenlabs-music",
  "mubert",
  "stable-audio",
  "loudly",
  "soundraw",
  "beatoven",
]);

export function isAiProviderId(providerId = "") {
  return AI_PROVIDER_IDS.has(String(providerId));
}

export function readAiInterfacesEnabled() {
  if (typeof window === "undefined") return AI_INTERFACES_DEFAULT_ENABLED;
  const stored = window.localStorage.getItem(AI_INTERFACES_STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return AI_INTERFACES_DEFAULT_ENABLED;
}

export function writeAiInterfacesEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_INTERFACES_STORAGE_KEY, enabled ? "true" : "false");
  window.document.cookie = `${AI_INTERFACES_COOKIE_NAME}=${enabled ? "true" : "false"}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(AI_INTERFACES_CHANGE_EVENT));
}

export function resetAiInterfacesOverride() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AI_INTERFACES_STORAGE_KEY);
  window.document.cookie = `${AI_INTERFACES_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  window.dispatchEvent(new CustomEvent(AI_INTERFACES_CHANGE_EVENT));
}

export function isAiInterfacesEnabledForRequest(request) {
  const cookieValue = request?.cookies?.get?.(AI_INTERFACES_COOKIE_NAME)?.value;
  if (cookieValue === "true") return true;
  if (cookieValue === "false") return false;
  return AI_INTERFACES_DEFAULT_ENABLED;
}
