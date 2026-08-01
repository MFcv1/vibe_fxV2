import React from "react";

const chainLabels = ["Frontend", "Hosting", "Auth", "Database", "Storage", "Paiements", "Backoffice", "Jobs / Monitoring"];

const stackCombos = [
  {
    key: "firebase",
    title: "Combo Firebase compact",
    summary:
      "Une seule maison Google : le site, les comptes, les données, les fichiers et les fonctions serveur vivent dans le même bloc produit.",
    mentalImage: "Comme une multiprise prémontée : peu de câbles visibles, très lisible pour démarrer.",
    modules: [
      { role: "Frontend", tool: "Next.js", detail: "Pages SSR + studio client" },
      { role: "Hosting", tool: "Firebase App Hosting", detail: "Déploiement web" },
      { role: "Auth", tool: "Firebase Auth", detail: "Connexion utilisateur" },
      { role: "Database", tool: "Firestore", detail: "Brouillons, profils, statuts" },
      { role: "Storage", tool: "Firebase Storage", detail: "Images, exports, médias" },
      { role: "Paiements", tool: "Stripe", detail: "Checkout + webhooks" },
      { role: "Backoffice", tool: "Console admin", detail: "Claims, jobs, litiges" },
      { role: "Jobs / Monitoring", tool: "Functions + Scheduler", detail: "OAuth, anti-doublon, logs" },
    ],
    coupled: {
      label: "Bloc couplé à montrer visuellement",
      tools: ["Hosting", "Auth", "Firestore", "Storage", "Functions"],
      note: "Les briques Firebase restent dans une même capsule : on comprend que l'auth lit/écrit dans Firestore, que Storage garde les fichiers et que Functions fait les actions sensibles côté serveur.",
    },
  },
  {
    key: "vercel-supabase-stripe",
    title: "Combo Vercel / Supabase / Stripe",
    summary:
      "Trois spécialistes branchés en chaîne : Vercel sert l'interface, Supabase garde l'identité et les données, Stripe encaisse.",
    mentalImage: "Comme trois ateliers alignés sur un convoyeur : vitrine, coffre-fort, caisse.",
    modules: [
      { role: "Frontend", tool: "Next.js", detail: "App Router + UI" },
      { role: "Hosting", tool: "Vercel", detail: "Edge + previews" },
      { role: "Auth", tool: "Supabase Auth", detail: "Session + providers" },
      { role: "Database", tool: "Postgres", detail: "Tables produit" },
      { role: "Storage", tool: "Supabase Storage", detail: "Fichiers utilisateur" },
      { role: "Paiements", tool: "Stripe", detail: "Abonnements, crédits" },
      { role: "Backoffice", tool: "Retool / Admin custom", detail: "Support + modération" },
      { role: "Jobs / Monitoring", tool: "Vercel Cron + Sentry", detail: "Tâches, alertes, erreurs" },
    ],
    coupled: {
      label: "Bloc couplé à montrer visuellement",
      tools: ["Vercel", "Supabase", "Stripe"],
      note: "Afficher Vercel, Supabase et Stripe comme trois grands wagons liés par des connecteurs nets : l'utilisateur voit qui héberge, qui stocke, qui facture.",
    },
  },
  {
    key: "astro-cloudflare-r2",
    title: "Combo Astro / Cloudflare / R2",
    summary:
      "Un site très rapide sur le réseau Cloudflare : Astro produit les pages, Workers ajoute la logique, R2 stocke les fichiers.",
    mentalImage: "Comme un kiosque léger posé partout dans le monde, avec une réserve R2 derrière le comptoir.",
    modules: [
      { role: "Frontend", tool: "Astro", detail: "Pages statiques + islands" },
      { role: "Hosting", tool: "Cloudflare Pages", detail: "CDN mondial" },
      { role: "Auth", tool: "Clerk / Auth.js", detail: "Connexion branchée" },
      { role: "Database", tool: "D1 / Neon", detail: "Données structurées" },
      { role: "Storage", tool: "R2", detail: "Objets sans egress Cloudflare" },
      { role: "Paiements", tool: "Stripe", detail: "Checkout + portail" },
      { role: "Backoffice", tool: "Workers Admin", detail: "Routes privées" },
      { role: "Jobs / Monitoring", tool: "Queues + Analytics", detail: "Jobs, logs, métriques" },
    ],
    coupled: {
      label: "Bloc couplé à montrer visuellement",
      tools: ["Astro", "Pages", "Workers", "R2"],
      note: "Dessiner Cloudflare comme une enveloppe autour de Pages, Workers et R2 : Astro construit la vitrine, Cloudflare la distribue et exécute les petites actions serveur.",
    },
  },
];

function ChainModule({ module, index }) {
  return (
    <li className="vf-stack-module">
      <span className="vf-stack-module__index">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <small>{module.role}</small>
        <strong>{module.tool}</strong>
        <em>{module.detail}</em>
      </div>
    </li>
  );
}

export function StackLegoArchitecture() {
  return (
    <section className="vf-stack-architecture" aria-labelledby="stack-architecture-title">
      <header className="vf-stack-architecture__header">
        <div>
          <p className="vf-kicker">Architecture visuelle</p>
          <h2 id="stack-architecture-title">Lire une stack comme une chaîne de LEGO.</h2>
        </div>
        <p>
          La base reste la même : une ligne A-to-Z de gauche à droite. Chaque brique répond à une question simple :
          qui affiche, qui héberge, qui connecte, qui garde, qui encaisse, qui surveille ?
        </p>
      </header>

      <ol className="vf-stack-axis" aria-label="Ordre de lecture A-to-Z d'une stack produit">
        {chainLabels.map((label, index) => (
          <li key={label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="vf-stack-combos">
        {stackCombos.map((combo) => (
          <article className="vf-stack-card" key={combo.key}>
            <div className="vf-stack-card__intro">
              <span className="vf-stack-card__eyebrow">Stack combo</span>
              <h3>{combo.title}</h3>
              <p>{combo.summary}</p>
              <small>{combo.mentalImage}</small>
            </div>

            <ol className="vf-stack-chain" aria-label={`Chaîne technique ${combo.title}`}>
              {combo.modules.map((module, index) => (
                <ChainModule module={module} index={index} key={`${combo.key}-${module.role}`} />
              ))}
            </ol>

            <aside className="vf-stack-coupled" aria-label={`Modules couplés ${combo.title}`}>
              <div>
                <span>{combo.coupled.label}</span>
                <strong>{combo.coupled.tools.join(" + ")}</strong>
              </div>
              <p>{combo.coupled.note}</p>
            </aside>
          </article>
        ))}
      </div>
    </section>
  );
}
