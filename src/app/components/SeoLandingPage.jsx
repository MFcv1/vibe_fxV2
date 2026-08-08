import Link from "next/link";
import { buildSeoJsonLd } from "../seo-pages";

export function SeoLandingPage({ page }) {
  const jsonLd = buildSeoJsonLd(page);

  return (
    <main className="vf-home vf-seo-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="vf-nav" aria-label="Navigation principale">
        <Link href="/" className="vf-brand" aria-label="Vibe_fx V2 accueil">
          <span className="vf-brand-mark" aria-hidden="true" />
          Vibe_fx
        </Link>
        <div className="vf-actions">
          <Link href="/pricing" className="vf-nav-cta">
            Tarification
          </Link>
          <Link href="/creer" className="vf-nav-cta">
            Launch app
          </Link>
        </div>
      </nav>

      <section className="vf-hero" aria-labelledby="seo-page-title">
        <div className="vf-hero-copy">
          <h1 id="seo-page-title">{page.h1}</h1>
          <p>{page.intro}</p>
          <div className="vf-actions" aria-label="Actions principales">
            <Link href="/creer" className="vf-primary">
              Ouvrir le studio
            </Link>
            <Link href="/outil-publication-reseaux-sociaux" className="vf-nav-cta">
              Voir le workflow
            </Link>
          </div>
          <div className="vf-hero-stats" aria-label="Points cles">
            {page.stats.map((stat) => (
              <span key={stat}>{stat}</span>
            ))}
          </div>
        </div>

        <div className="vf-product-shell" aria-label={page.proof}>
          <div className="vf-shell-topbar">
            <span className="vf-live-dot" aria-hidden="true" />
            <strong>vibefx.public</strong>
            <em>{page.proof}</em>
          </div>
          <section className="vf-publish-panel" aria-labelledby="seo-proof-title">
            <div>
              <span className="vf-mini-label">Workflow</span>
              <h2 id="seo-proof-title">{page.proof}</h2>
            </div>
            <ol className="vf-pipeline">
              {page.steps.map(([index, title, detail]) => (
                <li key={`${index}-${title}`}>
                  <span>{index}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </div>
                </li>
              ))}
            </ol>
            <div className="vf-platforms" aria-label="Surfaces reliees">
              <span>Studio</span>
              <span>Firebase</span>
              <span>Meta</span>
            </div>
          </section>
        </div>
      </section>

      <section className="vf-feature-band" aria-label="Preuves produit">
        {page.cards.map(([title, body]) => (
          <article className="vf-feature-card" key={title}>
            <span>Vibe_fx</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="vf-seo-faq" aria-labelledby="seo-faq-title">
        <div>
          <p className="vf-kicker">FAQ</p>
          <h2 id="seo-faq-title">Questions utiles.</h2>
        </div>
        <div className="vf-seo-faq__items">
          {page.faq.map(([question, answer]) => (
            <article key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
