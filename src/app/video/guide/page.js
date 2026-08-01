import { Suspense } from "react";
import GuidedFlow from "@/features/vibecut/guided/GuidedFlow";

export const metadata = {
  title: "Création guidée",
  robots: { index: false, follow: false },
};

export default function GuidedFlowPage() {
  return (
    <Suspense fallback={null}>
      <GuidedFlow />
    </Suspense>
  );
}
