import StudioAuthGate from "@/components/StudioAuthGate";
import VibeCutShell from "@/features/vibecut/shell/VibeCutShell";
// Seule feuille de style de VibeCut. Le bundle Tailwind statique de /studio n'est
// volontairement PAS charge ici: cette surface est isolee.
import "@/features/vibecut/styles/vibecut.css";

export const metadata = {
  title: "VibeCut",
  description: "Montage video VibeCut: montage rapide, creation guidee et montage avance.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VideoLayout({ children }) {
  return (
    <StudioAuthGate>
      <VibeCutShell>{children}</VibeCutShell>
    </StudioAuthGate>
  );
}
