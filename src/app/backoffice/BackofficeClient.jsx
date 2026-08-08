"use client";

import Link from "next/link";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AI_FRONT_SURFACES, AI_INTERFACES_DEFAULT_ENABLED } from "@/config/aiLaunch";
import { useAiLaunchSettings } from "@/hooks/useAiLaunchSettings";
import { auth, db, firebaseReady, functions as firebaseFunctions } from "@/lib/firebase";
import {
  aggregateCloudBillingTelemetry,
  aggregateVideoExportTelemetry,
  estimateVideoExportCost,
} from "./exportTelemetry";

export default function BackofficeClient() {
  const { aiInterfacesEnabled, setAiInterfacesEnabled, resetAiInterfaces } = useAiLaunchSettings();
  const [user, setUser] = useState(auth?.currentUser || null);
  const [authLoading, setAuthLoading] = useState(!auth?.currentUser); // true jusqu'au premier onAuthStateChanged
  const [exportJobs, setExportJobs] = useState([]);
  const [cloudBilling, setCloudBilling] = useState(null);
  const [exportTelemetryState, setExportTelemetryState] = useState({
    loading: Boolean(auth && db),
    message: auth ? "" : "Firebase Auth n'est pas initialise.",
  });
  const [authBusy, setAuthBusy] = useState(false);
  const disabledCount = aiInterfacesEnabled ? 0 : AI_FRONT_SURFACES.length;
  const exportTelemetry = useMemo(() => aggregateVideoExportTelemetry(exportJobs), [exportJobs]);
  const billingTelemetry = useMemo(() => aggregateCloudBillingTelemetry(cloudBilling), [cloudBilling]);

  const loadExportTelemetry = useCallback(async (currentUser) => {
    if (!firebaseReady || !db || !currentUser) {
      setExportJobs([]);
      setCloudBilling(null);
      setExportTelemetryState({
        loading: false,
        message: firebaseReady ? "Clique sur Rafraichir pour ouvrir l'acces Google dev et charger les exports." : "Firebase n'est pas configure.",
      });
      return;
    }

    setExportTelemetryState({ loading: true, message: "" });
    console.log("[backoffice] loadExportTelemetry uid=", currentUser?.uid, "email=", currentUser?.email, "firebaseFunctions=", Boolean(firebaseFunctions));
    try {
      if (firebaseFunctions) {
        try {
          console.log("[backoffice] calling getVideoExportAdminTelemetry...");
          const callable = httpsCallable(firebaseFunctions, "getVideoExportAdminTelemetry");
          const result = await callable({ limit: 120 });
          console.log("[backoffice] callable result:", result.data?.summary, "jobs:", result.data?.jobs?.length);
          const data = result.data || {};
          if (Array.isArray(data.jobs)) {
            setExportJobs(data.jobs);
            setCloudBilling(data.cloudBilling || null);
            setExportTelemetryState({
              loading: false,
              message: `Vue admin globale: ${data.summary?.totalJobs ?? data.jobs.length} jobs recents. ${formatBillingStateMessage(data.cloudBilling)}`,
            });
            return;
          }
        } catch (adminError) {
          const code = String(adminError.code || "");
          const msg = adminError.message || String(adminError);
          console.error("[backoffice] callable error code=", code, "msg=", msg, adminError);
          if (!code.includes("permission-denied")) {
            console.warn("Admin export telemetry unavailable", adminError);
            setExportTelemetryState({
              loading: false,
              message: `Erreur callable admin [${code}]: ${msg}`,
            });
            return;
          }
        }
      }

      const snapshot = await getDocs(query(
        collection(db, "videoExportJobs"),
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(100)
      ));
      setExportJobs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setCloudBilling(null);
      setExportTelemetryState({
        loading: false,
        message: "Vue limitee aux jobs lisibles par ce compte. La vue globale demande un compte admin.",
      });
    } catch (error) {
      setExportJobs([]);
      setCloudBilling(null);
      setExportTelemetryState({
        loading: false,
        message: error.message || "Lecture des exports impossible.",
      });
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      loadExportTelemetry(currentUser);
    });
  }, [loadExportTelemetry]);

  const ensureDevUser = useCallback(async () => {
    if (!auth) {
      setExportTelemetryState({
        loading: false,
        message: "Firebase Auth n'est pas initialise: impossible d'ouvrir l'acces dev.",
      });
      return null;
    }
    const currentUser = auth.currentUser || user;
    if (currentUser) return currentUser;
    setAuthBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      return credential.user || auth.currentUser || null;
    } catch (error) {
      setExportTelemetryState({
        loading: false,
        message: `Connexion dev impossible: ${error.message || "popup Google refusee."}`,
      });
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, [user]);

  const handleTelemetryRefresh = useCallback(async () => {
    const currentUser = auth?.currentUser || user || await ensureDevUser();
    if (!currentUser) return;
    await loadExportTelemetry(currentUser);
  }, [ensureDevUser, loadExportTelemetry, user]);

  // Gate : si Firebase initialise encore, spinner
  if (authLoading) {
    return (
      <div className="vf-studio-gate vf-studio-gate--loading" aria-busy="true">
        <span className="vf-studio-gate__spinner" />
      </div>
    );
  }

  // Gate : non connecté → écran de connexion
  if (!user) {
    return (
      <div className="vf-studio-gate" role="dialog" aria-modal="true" aria-labelledby="bo-gate-title">
        <div className="vf-studio-gate__card">
          <span className="vf-studio-gate__kicker">Backoffice</span>
          <h1 id="bo-gate-title" className="vf-studio-gate__title">Accès restreint</h1>
          <p className="vf-studio-gate__desc">
            Cette page est réservée aux administrateurs.<br />
            Connecte-toi avec le compte autorisé.
          </p>
          {exportTelemetryState.message && (
            <p className="vf-studio-gate__error">{exportTelemetryState.message}</p>
          )}
          <button
            type="button"
            className="vf-studio-gate__btn"
            disabled={authBusy}
            onClick={handleTelemetryRefresh}
          >
            {authBusy ? "Connexion..." : "Continuer avec Google"}
          </button>
          <Link href="/" className="vf-studio-gate__back">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="vf-backoffice">

      <nav className="vf-nav vf-backoffice-nav" aria-label="Navigation backoffice">
        <Link href="/" className="vf-brand" aria-label="Vibe_fx V2 accueil">
          <span className="vf-brand-mark" aria-hidden="true" />
          Vibe_fx
        </Link>
        <div className="vf-nav-links">
          <Link href="/creer">
            <span className="vf-nav-link-dot" aria-hidden="true" />
            Studio
          </Link>
          <Link href="/pricing">
            <span className="vf-nav-link-dot" aria-hidden="true" />
            Tarification
          </Link>
        </div>
        {user ? (
          <span className="vf-nav-user">
            {user.email || user.uid}
          </span>
        ) : (
          <button type="button" className="vf-nav-cta" onClick={handleTelemetryRefresh} disabled={authBusy}>
            {authBusy ? "Connexion..." : "Se connecter"}
          </button>
        )}
      </nav>

      <section className="vf-backoffice-hero" aria-labelledby="backoffice-title">
        <div className="vf-backoffice-copy">
          <p className="vf-kicker">Launch control</p>
          <h1 id="backoffice-title">Backoffice IA pour le premier lancement prod.</h1>
          <p>
            Firebase n&apos;est pas encore branche pour securiser ce backoffice. Ce switch agit donc comme
            override local navigateur: le deploy garde les interfaces IA masquees par defaut, et le bouton
            permet de les remettre en place pour verifier le prochain lancement.
          </p>
        </div>

        <aside className="vf-ai-launch-card" data-enabled={aiInterfacesEnabled ? "true" : "false"}>
          <span>{aiInterfacesEnabled ? "Override local actif" : "Mode lancement prod"}</span>
          <strong>{aiInterfacesEnabled ? "Interfaces IA visibles" : "Interfaces IA masquees"}</strong>
          <p>
            {aiInterfacesEnabled
              ? "Ce navigateur remonte les entrees IA pour controle. Le flag prod reste separe."
              : `${disabledCount} surfaces front/API IA sont masquees pour le lancement.`}
          </p>
          <div className="vf-ai-launch-actions">
            <button
              type="button"
              onClick={() => setAiInterfacesEnabled(!aiInterfacesEnabled)}
            >
              {aiInterfacesEnabled ? "Masquer l\u0027IA" : "Remettre l\u0027IA en place"}
            </button>
            <button type="button" onClick={resetAiInterfaces}>
              Revenir au defaut
            </button>
          </div>
          <dl>
            <div>
              <dt>Defaut deploy</dt>
              <dd>{AI_INTERFACES_DEFAULT_ENABLED ? "IA on" : "IA off"}</dd>
            </div>
            <div>
              <dt>Portee</dt>
              <dd>Navigateur local</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="vf-backoffice-grid" aria-label="Cartographie IA front">
        <article>
          <span>Objectif prod</span>
          <strong>Lancer sans fonctionnalite IA visible.</strong>
          <p>Le studio, la publication, le pricing premium et les sources musicales non IA restent accessibles.</p>
        </article>
        <article>
          <span>Retour un clic</span>
          <strong>Override local reversible.</strong>
          <p>Le code IA reste en place, mais non monte tant que le switch ou le flag env ne l&apos;active pas.</p>
        </article>
        <article>
          <span>Suite Firebase</span>
          <strong>Remplacer par un vrai gate serveur.</strong>
          <p>Quand Auth/claims seront prets, ce panneau devra devenir admin-only.</p>
        </article>
      </section>

      <ExportTelemetryPanel
        user={user}
        telemetry={exportTelemetry}
        billingTelemetry={billingTelemetry}
        jobs={exportJobs}
        loading={exportTelemetryState.loading}
        message={exportTelemetryState.message}
        onRefresh={handleTelemetryRefresh}
        authBusy={authBusy}
        canSignIn={Boolean(auth)}
      />

      <section className="vf-backoffice-table-panel" aria-labelledby="ai-map-title">
        <header>
          <div>
            <p className="vf-kicker">Surface map</p>
            <h2 id="ai-map-title">Interfaces IA neutralisees.</h2>
          </div>
          <span className="vf-backoffice-status" data-enabled={aiInterfacesEnabled ? "true" : "false"}>
            {aiInterfacesEnabled ? "Visible localement" : "Masque par defaut"}
          </span>
        </header>

        <div className="vf-backoffice-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Route</th>
                <th>Surface</th>
                <th>Etat sans IA</th>
              </tr>
            </thead>
            <tbody>
              {AI_FRONT_SURFACES.map((surface) => (
                <tr key={surface.id}>
                  <td>{surface.zone}</td>
                  <td><code>{surface.route}</code></td>
                  <td>{surface.surface}</td>
                  <td>{surface.disabledState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function buildTelemetryAlerts(telemetry, billingTelemetry, jobs) {
  const alerts = [];
  if (billingTelemetry.status === "not_configured") {
    alerts.push({ level: "warn", msg: "Billing Export BigQuery non configure: cout Google reel indisponible." });
  }
  if (billingTelemetry.status === "error") {
    alerts.push({ level: "error", msg: "Billing Export BigQuery configure mais lecture en erreur." });
  }
  if (billingTelemetry.status === "stale") {
    alerts.push({ level: "warn", msg: "Donnees Billing stale > 48h: verifier la configuration BigQuery." });
  }
  if (billingTelemetry.status === "ready" && billingTelemetry.total?.rows === 0) {
    alerts.push({ level: "warn", msg: "BigQuery lisible mais aucune ligne Cloud Run trouvee sur la periode." });
  }
  if (billingTelemetry.status === "ready" && telemetry.total?.readyExports > 0 && billingTelemetry.total?.netCost === 0) {
    alerts.push({ level: "warn", msg: "Facture Google disponible mais cout net zero: verifier le filtre Cloud Run." });
  }
  const jobsWithoutRenderer = jobs.filter((job) => job.status === "ready" && !job.rendererResult?.elapsedMs);
  if (jobsWithoutRenderer.length > 0) {
    alerts.push({ level: "warn", msg: `${jobsWithoutRenderer.length} job(s) ready sans duree renderer: estimation incomplète.` });
  }
  const jobsReadyNoOutput = jobs.filter((job) => job.status === "ready" && !(job.output?.sizeBytes > 0));
  if (jobsReadyNoOutput.length > 0) {
    alerts.push({ level: "warn", msg: `${jobsReadyNoOutput.length} job(s) ready sans output size.` });
  }
  if (telemetry.total?.activeJobs > 5) {
    alerts.push({ level: "warn", msg: `${telemetry.total.activeJobs} jobs actifs: surveiller la queue.` });
  }
  return alerts;
}

function formatCostValue(value, currency = "EUR", source) {
  if (value == null || value === undefined) return "Non disponible";
  if (!Number.isFinite(Number(value))) return "Estimation incomplete";
  if (Number(value) === 0 && source === "confirmed") return `0,00 ${currency} confirme`;
  return formatMoney(value, currency);
}

function formatBillingValue(value, currency, status) {
  if (status === "not_configured") return "Non configure";
  if (status === "error") return "Lecture erreur";
  if (status === "stale") return "Donnee stale";
  if (value == null || !Number.isFinite(Number(value))) return "Non disponible";
  if (Number(value) === 0 && status === "ready") return `0,00 ${currency || "EUR"} confirme`;
  return formatMoney(value, currency);
}

function ExportTelemetryPanel({ user, telemetry, billingTelemetry, jobs, loading, message, onRefresh, authBusy, canSignIn }) {
  const alerts = buildTelemetryAlerts(telemetry, billingTelemetry, jobs);
  const weekRange = telemetry.ranges?.find((r) => r.key === "week");
  const dayBilling = billingTelemetry.ranges?.find((r) => r.key === "day");

  return (
    <section className="vf-export-ops" aria-labelledby="export-ops-title" aria-busy={loading}>
      <header className="vf-export-ops-head">
        <div>
          <p className="vf-kicker">Telemetry couts VibeCut</p>
          <h2 id="export-ops-title">Exports video — Cloud Run — Facture Google.</h2>
          <p>
            Trois sources : <strong>Estimation interne</strong> (jobs Firestore, temps quasi reel),{" "}
            <strong>Facture Google BigQuery</strong> (differee, source comptable officielle),{" "}
            <strong>Ecart</strong> (reconciliation).
          </p>
        </div>
        <div className="vf-export-ops-actions">
          <span data-admin={user ? "true" : "false"}>
            {user?.email || user?.uid || "Non connecte"}
          </span>
          <button type="button" onClick={onRefresh} disabled={authBusy || loading || !canSignIn}>
            {authBusy ? "Connexion..." : loading ? "Lecture..." : "Rafraichir"}
          </button>
        </div>
      </header>

      {!user && (
        <div className="vf-export-signin-banner">
          <p>Connecte-toi avec ton compte Google admin pour voir les jobs et les couts.</p>
          <button type="button" onClick={onRefresh} disabled={authBusy}>
            {authBusy ? "Connexion en cours..." : "Se connecter avec Google"}
          </button>
        </div>
      )}

      {message ? <p className="vf-export-ops-note">{message}</p> : null}

      {alerts.length > 0 && (
        <ul className="vf-export-alerts" aria-label="Alertes telemetry">
          {alerts.map((alert, i) => (
            <li key={i} data-level={alert.level}>{alert.msg}</li>
          ))}
        </ul>
      )}

      {/* Row 1 : 3 cartes principales */}
      <div className="vf-export-total-grid" aria-label="Cartes principales couts">
        <article className="vf-export-total-card">
          <span>Estimation VibeCut live</span>
          <strong>
            {telemetry.total?.estimatedCostEur > 0
              ? formatMoney(telemetry.total.estimatedCostEur)
              : telemetry.total?.totalJobs > 0 ? "Estimation incomplete" : "Aucun job"}
          </strong>
          <dl>
            <div><dt>Jobs total</dt><dd>{telemetry.total?.totalJobs ?? "—"}</dd></div>
            <div><dt>Prets</dt><dd>{telemetry.total?.readyExports ?? "—"}</dd></div>
            <div><dt>Actifs</dt><dd>{telemetry.total?.activeJobs ?? "—"}</dd></div>
            <div><dt>Echecs</dt><dd>{telemetry.total?.failedJobs ?? "—"}</dd></div>
            <div><dt>Dev runs</dt><dd>{telemetry.total?.devRunJobs ?? "—"}</dd></div>
          </dl>
          <small>Source : jobs Firestore</small>
        </article>

        <article className="vf-export-total-card" data-billing-state={billingTelemetry.status}>
          <span>Facture Google BigQuery</span>
          <strong>{formatBillingValue(billingTelemetry.total?.netCost, billingTelemetry.currency, billingTelemetry.status)}</strong>
          <dl>
            <div><dt>Cout brut</dt><dd>{formatBillingValue(billingTelemetry.total?.actualCost, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
            <div><dt>Credits</dt><dd>{formatBillingValue(billingTelemetry.total?.credits, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
            <div><dt>Lignes lues</dt><dd>{billingTelemetry.status === "ready" ? (billingTelemetry.total?.rows ?? "—") : "Non configure"}</dd></div>
            <div><dt>Table</dt><dd>{billingTelemetry.table ? <code>{billingTelemetry.table}</code> : "Non configure"}</dd></div>
          </dl>
          <small>
            {billingTelemetry.status === "ready"
              ? "Source : BigQuery Billing — delai possible"
              : billingTelemetry.status === "not_configured"
              ? "Non configure : activer Billing Export"
              : billingTelemetry.message || "Source : BigQuery Billing"}
          </small>
        </article>

        <article className="vf-export-total-card">
          <span>Ecart estimation / facture</span>
          <strong>
            {billingTelemetry.status === "ready" && telemetry.total?.estimatedCostEur > 0
              ? formatMoney(telemetry.total.estimatedCostEur - (billingTelemetry.total?.netCost || 0))
              : "Non disponible"}
          </strong>
          <dl>
            <div><dt>Estimation</dt><dd>{telemetry.total?.estimatedCostEur > 0 ? formatMoney(telemetry.total.estimatedCostEur) : "Incomplete"}</dd></div>
            <div><dt>Facture nette</dt><dd>{formatBillingValue(billingTelemetry.total?.netCost, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
            <div><dt>Statut BigQuery</dt><dd>{billingTelemetry.status ?? "non_configured"}</dd></div>
          </dl>
          <small>Reconciliation estimation interne vs facture Google</small>
        </article>
      </div>

      {/* Row 2 : petites cartes KPI */}
      <div className="vf-export-metric-grid" aria-label="KPI par periode">
        {telemetry.ranges?.map((range) => (
          <article key={range.key} className="vf-export-metric-card">
            <span>{range.label}</span>
            <strong>
              {range.estimatedCostEur > 0
                ? formatMoney(range.estimatedCostEur)
                : range.totalJobs > 0 ? "Estimation incomplete" : "Aucun job"}
            </strong>
            <dl>
              <div><dt>Jobs</dt><dd>{range.totalJobs}</dd></div>
              <div><dt>Prets</dt><dd>{range.readyExports}</dd></div>
              <div><dt>Actifs</dt><dd>{range.activeJobs}</dd></div>
              <div><dt>Echecs</dt><dd>{range.failedJobs}</dd></div>
              {range.devRunJobs > 0 && <div><dt>Dev</dt><dd>{range.devRunJobs}</dd></div>}
            </dl>
            <small>jobs Firestore</small>
          </article>
        ))}
        {billingTelemetry.ranges?.map((range) => (
          <article key={`billing-${range.key}`} className="vf-export-billing-card">
            <span>Facture {range.label}</span>
            <strong>{formatBillingValue(range.netCost, billingTelemetry.currency, billingTelemetry.status)}</strong>
            <dl>
              <div><dt>Brut</dt><dd>{formatBillingValue(range.actualCost, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
              <div><dt>Credits</dt><dd>{formatBillingValue(range.credits, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
              <div><dt>Lignes</dt><dd>{billingTelemetry.status === "ready" ? range.rows : "—"}</dd></div>
            </dl>
            <small>BigQuery Billing</small>
          </article>
        ))}
        <article className="vf-export-metric-card">
          <span>Cout/minute estimé</span>
          <strong>
            {weekRange?.renderSeconds > 0 && weekRange?.estimatedCostEur > 0
              ? formatMoney((weekRange.estimatedCostEur / (weekRange.renderSeconds / 60)), "EUR")
              : "Non disponible"}
          </strong>
          <dl>
            <div><dt>Rendu semaine</dt><dd>{weekRange?.renderSeconds > 0 ? `${Math.round(weekRange.renderSeconds)}s` : "—"}</dd></div>
            <div><dt>Facture jour</dt><dd>{formatBillingValue(dayBilling?.netCost, billingTelemetry.currency, billingTelemetry.status)}</dd></div>
          </dl>
          <small>estimation locale</small>
        </article>
      </div>

      {/* Section services facturés */}
      <div className="vf-export-billing-panel">
        <header>
          <div>
            <span>Google Billing Export</span>
            <strong>{formatBillingPanelTitle(billingTelemetry)}</strong>
          </div>
          <small>
            {billingTelemetry.table
              ? `Table : ${billingTelemetry.table}`
              : billingTelemetry.message || "Configure CLOUD_BILLING_EXPORT_TABLE dans functions/.env pour activer."}
          </small>
        </header>
        {billingTelemetry.status === "ready" && billingTelemetry.services.length ? (
          <div className="vf-export-service-list">
            {billingTelemetry.services.map((service) => (
              <div key={service.service}>
                <span>{service.service}</span>
                <strong>{formatMoney(service.netCost, service.currency || billingTelemetry.currency)}</strong>
                <small>brut {formatMoney(service.cost, service.currency || billingTelemetry.currency)} — credits {formatMoney(service.credits, service.currency || billingTelemetry.currency)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>
            {billingTelemetry.status === "not_configured"
              ? "Billing Export BigQuery non configure."
              : billingTelemetry.status === "ready"
              ? "Aucune ligne Cloud Run sur la periode."
              : billingTelemetry.message || "Donnees indisponibles."}
          </p>
        )}
      </div>

      {/* Table jobs */}
      <div className="vf-export-ops-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Statut</th>
              <th>User</th>
              <th>Service / revision</th>
              <th>Format / preset</th>
              <th>Duree video</th>
              <th>Temps rendu</th>
              <th>Output</th>
              <th>Cout estime</th>
              <th>Source cout</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? telemetry.recentJobs.map((job) => {
              const estimate = estimateVideoExportCost(job);
              const preset = job.manifestSummary?.project?.preset || job.render?.preset || null;
              const format = job.render ? `${job.render.width || "?"}x${job.render.height || "?"} ${job.render.fps || "?"}fps` : null;
              const duration = Number(job.manifestSummary?.project?.duration || job.estimates?.durationSeconds || 0);
              const service = estimate.service || job.renderer?.service || null;
              const revision = estimate.revision || null;
              const uid = job.uid ? String(job.uid).slice(0, 10) + "…" : "—";
              return (
                <tr key={job.id} data-dev={job.devRun ? "true" : "false"}>
                  <td><code title={job.id}>{String(job.id || "").slice(0, 12)}…</code></td>
                  <td><span className="vf-export-status" data-status={job.status || "unknown"}>{formatExportStatus(job.status)}</span></td>
                  <td><code title={job.uid}>{job.devRun ? "dev" : uid}</code></td>
                  <td>{service ? <code>{service}{revision ? ` / ${String(revision).slice(-8)}` : ""}</code> : "Non disponible"}</td>
                  <td>{preset ? `${preset}` : format || "Non disponible"}</td>
                  <td>{formatDuration(duration)}</td>
                  <td>{estimate.renderSeconds > 0 ? `${Math.round(estimate.renderSeconds)}s` : "Non disponible"}</td>
                  <td>{formatBytes(estimate.outputSizeBytes)}</td>
                  <td>{estimate.estimatedEur > 0 ? formatMoney(estimate.estimatedEur) : "Estimation incomplete"}</td>
                  <td><small>{estimate.source || "—"}</small></td>
                  <td>{formatDate(job.createdAtDate || job.createdAt)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={11}>Aucun job export visible pour ce compte.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatBillingStateMessage(cloudBilling) {
  if (cloudBilling?.status === "ready") {
    return "Cout Google Cloud Run lu depuis Billing Export BigQuery.";
  }
  if (cloudBilling?.status === "error") {
    return "Billing Export BigQuery configure mais lecture en erreur.";
  }
  if (cloudBilling?.status === "stale") {
    return "Donnees Billing stale: dernier refresh > 48h.";
  }
  return "Billing Export BigQuery non configure: estimation interne uniquement.";
}

function formatBillingPanelTitle(billingTelemetry) {
  if (billingTelemetry.status === "ready") return "Facture Cloud Run — BigQuery";
  if (billingTelemetry.status === "error") return "Lecture facture en erreur";
  if (billingTelemetry.status === "stale") return "Donnee stale";
  if (billingTelemetry.status === "not_configured") return "Non configure";
  return "Facture non branchee";
}

function formatExportStatus(status) {
  const labels = {
    queued: "En file",
    rendering: "Rendu",
    finalizing: "Finalisation",
    ready: "Pret",
    failed: "Echoue",
    cancelled: "Annule",
  };
  return labels[status] || status || "Inconnu";
}

function formatRenderSpec(job, estimate) {
  const duration = Number(job.manifest?.project?.duration || job.estimates?.durationSeconds || 0);
  const size = estimate.width && estimate.height ? `${estimate.width}x${estimate.height}` : "Format inconnu";
  const fps = estimate.fps ? `${estimate.fps} FPS` : "FPS inconnu";
  return `${size} - ${fps} - ${formatDuration(duration)}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "duree inconnue";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function formatMoney(value, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(Number(value || 0));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "Non dispo";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} Mo`;
  return `${(bytes / (1024 ** 3)).toFixed(2)} Go`;
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
