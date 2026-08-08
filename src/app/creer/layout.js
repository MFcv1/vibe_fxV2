import StudioAuthGate from "@/components/StudioAuthGate";
import VibeOsShell from "@/features/vibeos/shell/VibeOsShell";
// Seule feuille de style de VibeOS. Le bundle Tailwind statique de /studio n'est
// volontairement PAS charge ici: cette surface est isolee (plan §2.2).
import "@/features/vibeos/styles/vibeos.css";

export const metadata = {
  title: {
    default: "Créer",
    template: "%s · VibeOS",
  },
  description: "VibeOS : l'incubateur de création Vibe_fx — visuels, ambiances, photos, musique et vidéo.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreerLayout({ children }) {
  return (
    <StudioAuthGate>
      <VibeOsShell>{children}</VibeOsShell>
    </StudioAuthGate>
  );
}
