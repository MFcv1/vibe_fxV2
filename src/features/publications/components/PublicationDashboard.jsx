"use client";

import { useSyncExternalStore } from "react";
import * as Icons from "lucide-react";
import { formatDate } from "../helpers/publicationHelpers";
import PublicationList from "./PublicationList";

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatMoney(cents) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

function safeDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function providerIds(user) {
  return (user?.providerData || []).map((provider) => provider.providerId).filter(Boolean);
}

export default function PublicationDashboard({ stats, publications, loading, selectedId, onBackToLayout, onSelectPublication, onDeletePublication, onSetHomeFeature, featureSaving, message, currentUser = null, accountData = null, aiInterfacesEnabled = false }) {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const latest = publications.slice(0, 6);
  const queued = publications.filter((item) => item.status !== "published").slice(0, 3);
  const published = publications.filter((item) => item.status === "published");
  const currentFeatured = published.find((item) => item.featured);
  const profile = accountData?.profile || {};
  const payments = accountData?.payments || [];
  const checkouts = accountData?.checkouts || [];
  const jobs = accountData?.jobs || [];
  const plan = profile.plan || "free";
  const providers = providerIds(currentUser);
  const lastPayment = payments[0];
  const lastCheckout = checkouts[0];
  const lastJob = jobs[0];

  return (
    <div className="pub-hub">
      <section className="pub-hub-hero">
        <div className="pub-hub-copy">
          <span className="pub-hub-kicker">PUBLICATIONS</span>
          <h2>Centre de publication</h2>
          <p>Finaliser, organiser et publier les contenus issus de Mise en page vers le site, Instagram et Facebook.</p>
        </div>
        <a
          href="/creer/layout-visuel"
          role="button"
          className="pub-hub-primary"
          style={{ visibility: hydrated ? "visible" : "hidden" }}
          onClick={(event) => {
            event.preventDefault();
            onBackToLayout();
          }}
        >
          <span>Creer une mise en page</span>
          <i><Icons.ArrowUpRight size={17} /></i>
        </a>
      </section>

      {message ? <div className="pub-message final">{message}</div> : null}

      <section className="pub-account-panel" aria-label="Profil utilisateur">
        <article className="pub-account-card pub-account-identity">
          <span className="pub-account-kicker">Profil</span>
          <strong>{currentUser?.email || currentUser?.displayName || "Session anonyme"}</strong>
          <small>{currentUser?.isAnonymous ? "anonymous" : providers.join(", ") || "compte permanent"}</small>
          <code>{currentUser?.uid || "uid indisponible"}</code>
        </article>
        <article className="pub-account-card">
          <span className="pub-account-kicker">Compte</span>
          <strong>{plan}</strong>
          <small>{profile.planUpdatedAt ? safeDate(profile.planUpdatedAt) : "Plan actuel"}</small>
        </article>
        <article className="pub-account-card">
          <span className="pub-account-kicker">Credits</span>
          <strong>{formatNumber(profile.creditBalance)}</strong>
          <small>{formatNumber(profile.reservedCreditBalance)} reserves / {formatNumber(profile.bonusCreditBalance)} bonus</small>
        </article>
        <article className="pub-account-card">
          <span className="pub-account-kicker">Paiements</span>
          <strong>{formatMoney(profile.lifetimePaidCents)}</strong>
          <small>{lastPayment ? `${lastPayment.status || "payment"} - ${safeDate(lastPayment.createdAt)}` : "Aucun paiement fulfil"}</small>
        </article>
        <article className="pub-account-card">
          <span className="pub-account-kicker">Checkout</span>
          <strong>{lastCheckout?.status || "Aucune session"}</strong>
          <small>{lastCheckout ? `${lastCheckout.productKey || "produit"} - ${safeDate(lastCheckout.updatedAt || lastCheckout.createdAt)}` : "Pas de session recente"}</small>
        </article>
        {aiInterfacesEnabled ? (
          <article className="pub-account-card">
            <span className="pub-account-kicker">Usage IA</span>
            <strong>{lastJob?.status || "Aucun job"}</strong>
            <small>{lastJob ? `${lastJob.feature || "feature"} - ${formatNumber(lastJob.capturedCredits || lastJob.estimatedCredits)} credits` : "Historique vide"}</small>
          </article>
        ) : null}
      </section>

      <section className="pub-hub-stats" aria-label="Etat des publications">
        <article>
          <Icons.FilePenLine size={18} />
          <strong>{stats.drafts}</strong>
          <span>Brouillons actifs</span>
        </article>
        <article>
          <Icons.Globe2 size={18} />
          <strong>{stats.published}</strong>
          <span>Publiees site</span>
        </article>
        <article>
          <Icons.Send size={18} />
          <strong>{stats.synced}</strong>
          <span>Synchronisees Insta</span>
        </article>
      </section>

      <section className="pub-hub-grid">
        <article className="pub-hub-card pub-hub-create">
          <div>
            <span className="pub-hub-card-kicker">Flux conseille</span>
            <h3>{"Composer, importer, verifier."}</h3>
            <p>{"Le studio reste plein ecran pour le visuel. Cette surface reprend ensuite le texte, la preview mobile et la publication reseaux."}</p>
          </div>
          <div className="pub-hub-steps">
            <span><b>01</b> Composer le visuel</span>
            <span><b>02</b> Importer vers publication</span>
            <span><b>03</b> Verifier la preview mobile</span>
          </div>
          <a
            href="/creer/layout-visuel"
            role="button"
            className="pub-hub-secondary"
            style={{ visibility: hydrated ? "visible" : "hidden" }}
            onClick={(event) => {
              event.preventDefault();
              onBackToLayout();
            }}
          >
            <Icons.LayoutTemplate size={16} />
            Ouvrir la mise en page
          </a>
        </article>

        <aside className="pub-hub-card pub-hub-recent">
          <div className="pub-hub-card-head">
            <div>
              <span className="pub-hub-card-kicker">File recente</span>
              <h3>Derniers contenus</h3>
            </div>
            <small>{latest.length} element(s)</small>
          </div>
          <div className="pub-feature-strip">
            <span className="pub-feature-strip-kicker">Mise en avant accueil</span>
            {currentFeatured ? (
              <div className="pub-feature-current">
                {currentFeatured.image ? <img src={currentFeatured.image} alt="" /> : <span className="pub-row-fallback"><Icons.Image size={18} /></span>}
                <span>
                  <strong>{currentFeatured.title || "Sans titre"}</strong>
                  <small>Publiee - {formatDate(currentFeatured.publishedAt || currentFeatured.updatedAt)}</small>
                </span>
                <button type="button" className="pub-feature-remove" disabled={featureSaving} onClick={() => onSetHomeFeature(null)}>
                  Retirer
                </button>
              </div>
            ) : (
              <div className="pub-feature-empty">
                <strong>Aucune publication mise en avant</strong>
                <small>Utilise le bouton Accueil sur une publication publiee.</small>
              </div>
            )}
          </div>
          <div className="pub-hub-list">
            <PublicationList
              publications={latest}
              loading={loading}
              selectedId={selectedId}
              onSelect={onSelectPublication}
              onDelete={onDeletePublication}
              onSetHomeFeature={onSetHomeFeature}
              featureSaving={featureSaving}
            />
          </div>
        </aside>

        <article className="pub-hub-card pub-hub-queue">
          <span className="pub-hub-card-kicker">A finaliser</span>
          <h3>Brouillons en attente</h3>
          {queued.length ? (
            <div className="pub-hub-mini-list">
              {queued.map((item) => (
                <button type="button" key={item.id} onClick={() => onSelectPublication(item)}>
                  {item.image ? <img src={item.image} alt="" /> : <Icons.Image size={16} />}
                  <span>{item.title || "Sans titre"}</span>
                </button>
              ))}
            </div>
          ) : (
            <p>Aucun brouillon en attente. Lance une mise en page pour creer la prochaine publication.</p>
          )}
        </article>

        <article className="pub-hub-card pub-hub-checks">
          <span className="pub-hub-card-kicker">Checker</span>
          <h3>Avant publication</h3>
          <ul>
            <li>Format Instagram verifie dans la preview iPhone.</li>
            <li>{"Description et hashtags ajustes apres l'import."}</li>
            <li>Publication site separee de la synchronisation Meta.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
