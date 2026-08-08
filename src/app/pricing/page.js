import Link from "next/link";
import { buildSeoJsonLd, buildSeoMetadata, getSeoPage } from "../seo-pages";

const page = getSeoPage("/pricing");

export const metadata = buildSeoMetadata(page);

const lifetimeOffer = {
  name: "Vibe_fx Lifetime",
  price: "9,99 EUR",
  tag: "Paiement unique",
  description: "Un seul achat pour debloquer l'interface Vibe_fx du lancement.",
  details: [
    "Studio image et mise en page",
    "Vibe_CUT et Soundtrack non-IA",
    "Preparation des publications sociales",
    "Exports et formats sociaux inclus",
    "Mises a jour de l'interface incluses",
  ],
  productKey: "premium_lifetime",
};

const includedFeatures = [
  ["Creation", "Composez visuels, textes, fonds, formats et rendus sociaux dans le studio."],
  ["Video", "Montez des clips courts, ajoutez audio, titres, transitions et exports navigateur."],
  ["Publication", "Preparez titre, caption, image, formats sociaux et statut depuis le meme espace."],
  ["Compte", "Gardez votre acces lifetime rattache a un compte Google ou email."],
];

const launchNotes = [
  "Aucun abonnement mensuel.",
  "Aucun pack de credits a acheter pour ce lancement.",
  "Les fonctions IA restent masquees tant qu'elles ne sont pas lancees publiquement.",
];

export default function PricingPage() {
  const jsonLd = buildSeoJsonLd(page);

  return (
    <main className="vf-home vf-pricing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="vf-nav" aria-label="Navigation principale">
        <Link href="/" className="vf-brand" aria-label="Vibe_fx V2 accueil">
          <span className="vf-brand-mark" aria-hidden="true" />
          Vibe_fx
        </Link>
        <div className="vf-nav-links" aria-label="Sections produit">
          <Link href="/account">
            <span className="vf-nav-link-dot" aria-hidden="true" />
            Compte
          </Link>
          <Link href="/creer">
            <span className="vf-nav-link-dot" aria-hidden="true" />
            Studio
          </Link>
        </div>
        <Link href={`/account/billing?product=${lifetimeOffer.productKey}`} className="vf-nav-cta">
          Acheter
        </Link>
      </nav>

      <section className="vf-pricing-hero" aria-labelledby="pricing-title">
        <div className="vf-pricing-copy">
          <p className="vf-kicker">Lifetime</p>
          <h1 id="pricing-title">Tout Vibe_fx pour 9,99 EUR.</h1>
          <p>
            Un paiement unique pour acceder aux surfaces de creation, de montage et de
            preparation publication disponibles au lancement. Pas d&apos;abonnement mensuel.
          </p>
          <div className="vf-actions">
            <Link href={`/account/billing?product=${lifetimeOffer.productKey}`} className="vf-primary">
              Acheter l&apos;acces lifetime
            </Link>
            <Link href="/creer" className="vf-secondary">
              Voir le studio
            </Link>
          </div>
        </div>

        <aside className="vf-pricing-ledger" aria-label="Resume de l'offre">
          <div className="vf-shell-topbar">
            <span className="vf-live-dot" aria-hidden="true" />
            <strong>Acces lifetime</strong>
            <em>9,99 EUR</em>
          </div>
          <dl>
            <div>
              <dt>Paiement</dt>
              <dd>Unique</dd>
            </div>
            <div>
              <dt>Interface</dt>
              <dd>Incluse</dd>
            </div>
            <div>
              <dt>Studio</dt>
              <dd>Debloque</dd>
            </div>
            <div>
              <dt>Compte</dt>
              <dd>Requis</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="vf-pricing-grid" aria-label="Offre Vibe_fx">
        <article className="vf-price-card" data-highlighted="true">
          <span>{lifetimeOffer.tag}</span>
          <h2>{lifetimeOffer.name}</h2>
          <strong>{lifetimeOffer.price}</strong>
          <p>{lifetimeOffer.description}</p>
          <ul>
            {lifetimeOffer.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <Link href={`/account/billing?product=${lifetimeOffer.productKey}`}>
            Acheter via mon compte
          </Link>
        </article>
      </section>

      <section className="vf-tokenomics" aria-labelledby="included-title">
        <div>
          <p className="vf-kicker">Inclus</p>
          <h2 id="included-title">Un acces simple a l&apos;interface.</h2>
          <p>
            Le prix couvre les outils visibles du lancement: creation image, preparation
            publication, montage video court et bibliotheque musicale non-IA.
          </p>
        </div>
        <div className="vf-tokenomics-table">
          {includedFeatures.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="vf-pricing-guards" aria-label="Notes de lancement">
        {launchNotes.map((note) => (
          <article key={note}>
            <span>Note</span>
            <p>{note}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
