"use client";

import Link from "next/link";
import AuthButton from "@/components/AuthButton";

export default function HomeNav() {
  return (
    <nav className="vf-nav" aria-label="Navigation principale">
      <Link href="/" className="vf-brand" aria-label="Vibe_fx V2 accueil">
        <span className="vf-brand-mark" aria-hidden="true" />
        Vibe_fx
      </Link>
      <div className="vf-nav-links" aria-label="Sections produit">
        <Link href="/pricing">
          <span className="vf-nav-link-dot" aria-hidden="true" />
          Tarification
        </Link>

      </div>
      <div className="vf-nav-actions">
        <AuthButton />
        <Link href="/creer/layout-visuel" className="vf-nav-cta">
          Launch app
        </Link>
      </div>
    </nav>
  );
}
