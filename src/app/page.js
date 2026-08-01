import Link from "next/link";
import Image from "next/image";
import { AI_INTERFACES_DEFAULT_ENABLED } from "@/config/aiLaunch";
import { PublicationRoutePipeline } from "./components/PublicationRoutePipeline";
import { StackLegoArchitecture } from "./components/StackLegoArchitecture";
import HomeNav from "./components/HomeNav";

export const metadata = {
  title: "Vibe_fx V2 - Éditeur d'image et Publication Instagram & Facebook",
  description:
    "Créez vos visuels sociaux, ajustez les formats 4:5 et 9:16, préparez vos captions et publiez directement sur Instagram et Facebook via Meta OAuth sécurisé.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vibe_fx V2 - Éditeur de visuels et Publication sociale",
    description:
      "Studio de création d'images et pipeline de publication sociale multi-plateforme sécurisé côté serveur.",
    url: "/",
    siteName: "Vibe_fx V2",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const featureCards = [
  {
    name: "Éditeur d'images",
    status: "Canvas actif",
    body: "Formats feed 4:5 et story 9:16, calques de textes stylisés, arrière-plans colorés et effets de flou cinétique.",
  },
  {
    name: "Brouillons de publication",
    status: "Draft sync",
    body: "Rattachez vos visuels à des captions descriptives, des hashtags pertinents et suivez les verrous d'anti-doublon.",
  },
  {
    name: "Aperçus dynamiques",
    status: "Aperçu direct",
    body: "Visualisez le rendu exact de votre publication sur mobile dans des simulations d'écrans Instagram et Facebook.",
  },
  {
    name: "OAuth Meta & Publication",
    status: "Connecté serveur",
    body: "Associez vos pages Facebook et comptes Instagram Business via un protocole OAuth 2.0 entièrement sécurisé côté serveur.",
  },
];

const pipelineSteps = [
  ["01", "Image", "Canvas editor"],
  ["02", "Brouillon", "Publication composer"],
  ["03", "Meta", "Instagram + Facebook"],
];

const faqItems = [
  [
    "Qu'est-ce que Vibe_fx V2 ?",
    "Vibe_fx V2 est un studio de création visuelle et un pipeline de publication sociale tout-en-un. Vous créez vos visuels, composez votre publication (titre, caption, hashtags) et publiez directement sur vos réseaux sociaux depuis la même interface.",
  ],
  [
    "Comment fonctionne la publication sécurisée ?",
    "Nous utilisons le protocole officiel Meta OAuth 2.0. Vos tokens d'accès et secrets de connexion restent chiffrés côté serveur à l'aide de clés fortes (AES-256-GCM) dans Firebase functions et Secret Manager, sans jamais transiter sur le client.",
  ],
  [
    "Quels formats d'images sont pris en charge ?",
    "Le studio prend en charge le format Portrait (4:5) idéal pour maximiser l'engagement dans le fil d'actualité, ainsi que le format Story/Reel cover (9:16).",
  ],
  [
    "Puis-je enregistrer des brouillons avant de publier ?",
    "Absolument. Vos créations sont rattachées de façon anonyme ou connectée à votre profil utilisateur Firestore. Vous pouvez modifier vos brouillons à tout moment depuis le studio avant d'initier la diffusion.",
  ],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Vibe_fx V2",
  url: "https://vibefx.app/",
  inLanguage: "fr-FR",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "Studio web SSR unique pour créer des visuels sociaux, préparer des publications et publier vers Instagram et Facebook via Meta OAuth sécurisé côté serveur.",
  publisher: {
    "@type": "Organization",
    name: "Vibe_fx",
    url: "https://vibefx.app/",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
};

export default function Home() {
  return (
    <main className="vf-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HomeNav />

      <section className="vf-hero" aria-labelledby="home-title">
        <div className="vf-hero-copy">
          <h1 id="home-title">
            Crée ton visuel social. Publie sur Instagram et Facebook.
          </h1>
          <p>
            Vibe_fx V2 rassemble l&apos;éditeur de visuels, la préparation de publication
            et la diffusion sécurisée Instagram/Facebook dans une page SSR unique,
            indexable et ultra-rapide.
          </p>
          <div className="vf-actions" aria-label="Actions principales">
            <Link href="/studio?workspace=layout" className="vf-primary">
              Launch app
            </Link>
            <Link href="/pricing" className="vf-secondary">
              {AI_INTERFACES_DEFAULT_ENABLED ? "Voir credits IA" : "Voir tarifs"}
            </Link>
          </div>
          <div className="vf-hero-stats" aria-label="Statuts du workflow">
            <span>Canvas prêt</span>
            <span>Brouillon sync</span>
            <span>OAuth Meta serveur</span>
          </div>
        </div>

        <div className="vf-product-shell" aria-label="Aperçu du studio Vibe_fx">
          <div className="vf-shell-topbar">
            <span className="vf-live-dot" aria-hidden="true" />
            <strong>studio.vibefx</strong>
            <em>SSR product proof</em>
          </div>

          <div className="vf-shell-grid">
            <section className="vf-editor-preview" aria-labelledby="editor-preview-title">
              <div className="vf-editor-toolbar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="vf-canvas-card">
                <Image
                  src="/assets/vibefx/demo-astronaut.png"
                  alt="Aperçu d'un visuel social créé dans l'éditeur Vibe_fx"
                  fill
                  priority
                  sizes="(max-width: 860px) 100vw, 38vw"
                />
                <div className="vf-canvas-overlay">
                  <span>4:5 portrait</span>
                  <strong id="editor-preview-title">Social image editor</strong>
                </div>
              </div>
            </section>

            <section className="vf-publish-panel" aria-labelledby="publish-panel-title">
              <div>
                <span className="vf-mini-label">Publication</span>
                <h2 id="publish-panel-title">Pipeline instantané quand Meta OAuth est prêt.</h2>
              </div>
              <ol className="vf-pipeline">
                {pipelineSteps.map(([index, title, detail]) => (
                  <li key={title}>
                    <span>{index}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="vf-platforms" aria-label="Plateformes cible">
                <span>Instagram</span>
                <span>Facebook</span>
                <span>Site</span>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="vf-feature-band" aria-label="Fonctionnalités principales">
        {featureCards.map((card) => (
          <article className="vf-feature-card" key={card.name}>
            <span>{card.status}</span>
            <h2>{card.name}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <PublicationRoutePipeline />

      <StackLegoArchitecture />

      <section className="vf-seo-faq" aria-labelledby="home-faq-title">
        <div>
          <p className="vf-kicker">FAQ</p>
          <h2 id="home-faq-title">Questions utiles avant de publier.</h2>
        </div>
        <div className="vf-seo-faq__items">
          {faqItems.map(([question, answer]) => (
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
