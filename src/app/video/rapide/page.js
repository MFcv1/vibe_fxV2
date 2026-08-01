import { Suspense } from "react";
import QuickEditor from "@/features/vibecut/quick/QuickEditor";

export const metadata = {
  title: "Montage rapide",
  robots: { index: false, follow: false },
};

export default function QuickEditorPage() {
  return (
    <Suspense fallback={null}>
      <QuickEditor />
    </Suspense>
  );
}
