"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAiLaunchSettings } from "@/hooks/useAiLaunchSettings";
import { auth, db, firebaseReady, functions } from "../../lib/firebase";

const viewLabels = {
  overview: "Compte",
  billing: "Acces lifetime",
  usage: "Activite",
};

const billingProducts = [
  { key: "premium_lifetime", label: "Vibe_fx Lifetime - 9,99 EUR", detail: "Acces a toute l'interface visible du lancement." },
  { key: "credits_500", label: "500 credits", detail: "Pack demarrage" },
  { key: "credits_1200", label: "1 200 credits", detail: "Pack createur" },
  { key: "credits_3200", label: "3 200 credits", detail: "Pack production" },
  { key: "credits_7000", label: "7 000 credits", detail: "Pack studio" },
];

const aiFeatureOptions = [
  { key: "text.caption.draft", label: "Caption draft" },
  { key: "text.prompt_rewrite.draft", label: "Prompt rewrite draft" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function providerIds(user) {
  return (user?.providerData || []).map((provider) => provider.providerId).filter(Boolean);
}

async function reauthenticateBeforeDeletion(user) {
  const providers = providerIds(user);
  if (providers.includes("google.com")) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await reauthenticateWithPopup(user, provider);
    await user.getIdToken(true);
    return;
  }

  if (providers.includes("password")) {
    const email = user.email || "";
    const password = window.prompt("Confirme ton mot de passe pour supprimer le compte.");
    if (!email || !password) {
      throw new Error("Reconnexion requise avant suppression.");
    }
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
    await user.getIdToken(true);
    return;
  }

  throw new Error("Reconnecte-toi avec Google ou email avant suppression.");
}

async function upsertUserProfile(user) {
  if (!db || !user) return null;

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  const payload = {
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    isAnonymous: Boolean(user.isAnonymous),
    providers: providerIds(user),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!snapshot.exists()) {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, payload, { merge: true });
  }

  return (await getDoc(ref)).data();
}

function safeDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatProductLabel(value) {
  if (value === "premium_lifetime") return "Vibe_fx Lifetime";
  if (value === "credits") return "Pack";
  return value || "Achat";
}

function formatPaymentStatus(value) {
  const labels = {
    fulfilled: "Valide",
    open: "En attente",
    creating: "En preparation",
    expired: "Expire",
    failed: "Echoue",
    canceled: "Annule",
  };
  return labels[value] || value || "En attente";
}

export default function AccountClient({ initialView = "overview" }) {
  const { aiInterfacesEnabled } = useAiLaunchSettings();
  const [view, setView] = useState(initialView);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(Boolean(auth));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(auth ? "" : "Connexion compte indisponible.");
  const [authMode, setAuthMode] = useState("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [aiFeature, setAiFeature] = useState(aiFeatureOptions[0].key);
  const [aiPrompt, setAiPrompt] = useState("");

  const refreshAccountData = useCallback(async (currentUser) => {
    if (!db || !currentUser) {
      setProfile(null);
      setJobs([]);
      setPayments([]);
      return;
    }

    const nextProfile = await upsertUserProfile(currentUser);
    setProfile(nextProfile || {});

    const [jobSnapshot, paymentSnapshot] = await Promise.all([
      aiInterfacesEnabled
        ? getDocs(query(
          collection(db, "aiJobs"),
          where("uid", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(8)
        )).catch(() => ({ docs: [] }))
        : Promise.resolve({ docs: [] }),
      getDocs(query(
        collection(db, "payments"),
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(8)
      )).catch(() => ({ docs: [] })),
    ]);

    setJobs(jobSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setPayments(paymentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, [aiInterfacesEnabled]);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setMessage("");
      try {
        let resolvedUser = currentUser;
        if (!resolvedUser) {
          resolvedUser = (await signInAnonymously(auth)).user;
        }
        setUser(resolvedUser);
        setEmail(resolvedUser.email || "");
        setDisplayName(resolvedUser.displayName || "");
        await refreshAccountData(resolvedUser);
      } catch (error) {
        setMessage(error.message || "Connexion compte indisponible.");
      } finally {
        setLoading(false);
      }
    });
  }, [refreshAccountData]);

  const status = useMemo(() => {
    const plan = profile?.plan || "free";
    return {
      plan,
      premium: plan === "premium",
      paid: profile?.lifetimePaidCents || 0,
    };
  }, [profile]);

  const visibleBillingProducts = useMemo(() => (
    aiInterfacesEnabled
      ? billingProducts
      : billingProducts
        .filter((product) => product.key === "premium_lifetime")
        .map((product) => ({ ...product, detail: "Acces a toute l'interface visible du lancement." }))
  ), [aiInterfacesEnabled]);

  const handleGoogle = async () => {
    if (!auth) return;
    setBusy(true);
    setMessage("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      let credential;
      if (auth.currentUser?.isAnonymous) {
        credential = await linkWithPopup(auth.currentUser, provider).catch(async (error) => {
          if (error.code === "auth/credential-already-in-use" || error.code === "auth/email-already-in-use") {
            return signInWithPopup(auth, provider);
          }
          throw error;
        });
      } else {
        credential = await signInWithPopup(auth, provider);
      }
      setUser(credential.user);
      await refreshAccountData(credential.user);
      setMessage("Compte Google connecte.");
    } catch (error) {
      setMessage(error.message || "Connexion Google impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAction = async (event) => {
    event.preventDefault();
    if (!auth || !email || !password) return;
    setBusy(true);
    setMessage("");
    try {
      let credential;
      if (authMode === "login") {
        credential = await signInWithEmailAndPassword(auth, email, password);
      } else if (auth.currentUser?.isAnonymous) {
        credential = await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password));
      } else {
        credential = await createUserWithEmailAndPassword(auth, email, password);
      }
      if (displayName && credential.user.displayName !== displayName) {
        await updateProfile(credential.user, { displayName });
      }
      setUser(credential.user);
      await refreshAccountData(credential.user);
      setMessage(authMode === "login" ? "Session ouverte." : "Compte permanent lie.");
    } catch (error) {
      setMessage(error.message || "Action email impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async () => {
    if (!auth?.currentUser) return;
    setBusy(true);
    setMessage("");
    try {
      await updateProfile(auth.currentUser, { displayName });
      await refreshAccountData(auth.currentUser);
      setMessage("Profil mis a jour.");
    } catch (error) {
      setMessage(error.message || "Mise a jour profil impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      await signOut(auth);
      setMessage("Session fermee. Une session anonyme de test sera recreee.");
    } finally {
      setBusy(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!functions || !auth?.currentUser) {
      setMessage("La suppression de compte est indisponible pour le moment.");
      return;
    }
    if (!window.confirm("Supprimer ce compte et purger les donnees utilisateur ? Cette action est irreversible.")) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await reauthenticateBeforeDeletion(auth.currentUser);
      const requestDeletion = httpsCallable(functions, "requestAccountDeletion");
      await requestDeletion({});
      await signOut(auth).catch(() => undefined);
      setUser(null);
      setProfile(null);
      setJobs([]);
      setPayments([]);
      setMessage("Compte supprime.");
    } catch (error) {
      setMessage(error.message || "Suppression compte impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckout = async (productKey) => {
    if (!aiInterfacesEnabled && String(productKey || "").startsWith("credits_")) {
      setMessage("Ce produit n'est pas disponible sur le premier lancement.");
      return;
    }
    if (!functions || !auth?.currentUser) {
      setMessage("Le paiement est indisponible pour le moment.");
      return;
    }
    if (auth.currentUser.isAnonymous) {
      setMessage("Lie un compte permanent avant achat.");
      setView("overview");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const createCheckout = httpsCallable(functions, "createCheckoutSession");
      const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      const clientRequestId = `${Date.now()}_${randomId}`;
      const result = await createCheckout({ productKey, clientRequestId });
      const url = result.data?.url;
      if (!url) throw new Error("Lien de paiement indisponible.");
      window.location.assign(url);
    } catch (error) {
      setMessage(error.message || "Ouverture du paiement impossible.");
      setBusy(false);
    }
  };

  const handleCreateAiJob = async (event) => {
    event.preventDefault();
    if (!aiInterfacesEnabled) {
      setMessage("Ce module n'est pas disponible sur le premier lancement.");
      return;
    }
    if (!functions || !auth?.currentUser) {
      setMessage("Ce module est indisponible pour le moment.");
      return;
    }
    if (auth.currentUser.isAnonymous) {
      setMessage("Lie un compte permanent avant de lancer un job IA.");
      setView("overview");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const createJob = httpsCallable(functions, "createAiJob");
      const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      const clientRequestId = `${Date.now()}_${randomId}`;
      const result = await createJob({ feature: aiFeature, prompt: aiPrompt, clientRequestId });
      await refreshAccountData(auth.currentUser);
      setAiPrompt("");
      setMessage(`Job IA ${result.data?.status || "cree"}: ${result.data?.jobId || ""}`.trim());
    } catch (error) {
      setMessage(error.message || "Creation job IA impossible.");
    } finally {
      setBusy(false);
    }
  };

  const isAnonymous = Boolean(user?.isAnonymous);
  const providers = providerIds(user);

  return (
    <main className="vf-account-shell">
      {/* Top bar minimal */}
      <nav className="vf-account-topbar" aria-label="Navigation principale">
        <Link href="/" className="vf-brand" aria-label="Vibe_fx V2 accueil">
          <span className="vf-brand-mark" aria-hidden="true" />
          Vibe_fx
        </Link>
        <Link href="/creer" className="vf-account-topbar__cta">Studio</Link>
      </nav>

      <div className="vf-account-layout">
        {/* Sidebar gauche */}
        <aside className="vf-account-sidebar" aria-label="Navigation compte">
          <div className="vf-account-sidebar__identity" data-state={isAnonymous ? "warning" : "success"}>
            <div className="vf-account-sidebar__avatar" aria-hidden="true">
              {user?.photoURL
                ? <img src={user.photoURL} alt="" width={40} height={40} referrerPolicy="no-referrer" />
                : <span>{(user?.email || "?")[0].toUpperCase()}</span>}
            </div>
            <div>
              <strong>{user?.displayName || user?.email || "Anonyme"}</strong>
              <small>{isAnonymous ? "Session temporaire" : "Compte lie"}</small>
            </div>
          </div>

          <nav className="vf-account-sidebar__nav" role="tablist" aria-label="Sections compte">
            {Object.entries(viewLabels).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                data-active={view === key}
                onClick={() => setView(key)}
                className="vf-account-sidebar__tab"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="vf-account-sidebar__footer">
            {!firebaseReady ? null : isAnonymous ? (
              <button type="button" className="vf-account-sidebar__connect" disabled={busy} onClick={handleGoogle}>
                {busy ? "Connexion..." : "Se connecter"}
              </button>
            ) : (
              <button type="button" className="vf-account-sidebar__signout" disabled={busy} onClick={handleSignOut}>
                Deconnecter
              </button>
            )}
          </div>
        </aside>

        {/* Contenu principal */}
        <section className="vf-account-main" aria-live="polite" aria-busy={loading}>
          {message && <p className="vf-account-message">{message}</p>}
          {!firebaseReady && !message && <p className="vf-account-message danger">Connexion compte indisponible.</p>}

          {view === "overview" && (
            <div className="vf-account-view">
              <div className="vf-account-view__header">
                <h1>Compte</h1>
                <p>Gerez votre connexion, votre profil et vos informations.</p>
              </div>
              <article className="vf-account-card">
                <div className="vf-account-card__head">
                  <span>Connexion</span>
                  <strong>{isAnonymous ? "Lier un compte" : "Compte lie"}</strong>
                </div>
                {isAnonymous && (
                  <p className="vf-account-card__desc">
                    Un compte permanent permet d&apos;associer l&apos;achat lifetime a votre profil.
                  </p>
                )}
                <button type="button" className="vf-account-primary" disabled={busy || loading} onClick={handleGoogle}>
                  {busy ? "Traitement..." : isAnonymous ? "Continuer avec Google" : "Changer de compte Google"}
                </button>
                {isAnonymous && (
                  <form className="vf-account-form" onSubmit={handleEmailAction}>
                    <div className="vf-account-segment">
                      <button type="button" data-active={authMode === "link"} onClick={() => setAuthMode("link")}>Creer</button>
                      <button type="button" data-active={authMode === "login"} onClick={() => setAuthMode("login")}>Connexion</button>
                    </div>
                    <label>
                      <span>Email</span>
                      <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label>
                      <span>Mot de passe</span>
                      <input type="password" value={password} autoComplete={authMode === "login" ? "current-password" : "new-password"} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                    {authMode === "link" && (
                      <label>
                        <span>Nom public</span>
                        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                      </label>
                    )}
                    <button type="submit" disabled={busy || !email || !password}>
                      {authMode === "login" ? "Ouvrir la session" : "Lier le compte"}
                    </button>
                  </form>
                )}
              </article>
              <article className="vf-account-card">
                <div className="vf-account-card__head">
                  <span>Profil</span>
                  <strong>Informations</strong>
                </div>
                <dl className="vf-account-facts">
                  <div><dt>Email</dt><dd>{user?.email || "Non renseigne"}</dd></div>
                  <div><dt>Derniere connexion</dt><dd>{safeDate(profile?.lastLoginAt)}</dd></div>
                  <div><dt>Total paye</dt><dd>{(status.paid / 100).toFixed(2)} EUR</dd></div>
                </dl>
                <div className="vf-account-actions">
                  <button type="button" onClick={handleProfileSave} disabled={busy || isAnonymous}>Enregistrer profil</button>
                  <button type="button" onClick={handleAccountDeletion} disabled={busy || isAnonymous}>Supprimer compte</button>
                </div>
              </article>
            </div>
          )}

          {view === "billing" && (
            <div className="vf-account-view">
              <div className="vf-account-view__header">
                <h1>Acces lifetime</h1>
                <p>Activez l&apos;acces complet a Vibe_fx et gerez vos credits.</p>
              </div>
              <article className="vf-account-card">
                <div className="vf-account-card__head">
                  <span>Acces actuel</span>
                  <strong>{status.premium ? "Lifetime actif" : "Gratuit"}</strong>
                </div>
                <div className="vf-account-metric">
                  <strong>{status.premium ? "Lifetime" : "Gratuit"}</strong>
                </div>
                <div className="vf-account-bars">
                  <span style={{ "--value": status.premium ? "100%" : "38%" }}>Studio</span>
                  <span style={{ "--value": status.premium ? "100%" : "38%" }}>Vibe_CUT</span>
                  <span style={{ "--value": status.premium ? "100%" : "38%" }}>Publication</span>
                </div>
                <Link href="/pricing" className="vf-account-secondary">Voir les tarifs</Link>
              </article>
              <BillingPanel
                aiInterfacesEnabled={aiInterfacesEnabled}
                busy={busy}
                products={visibleBillingProducts}
                payments={payments}
                onCheckout={handleCheckout}
              />
            </div>
          )}

          {view === "usage" && (
            <div className="vf-account-view">
              <div className="vf-account-view__header">
                <h1>Activite</h1>
                <p>Historique de vos jobs et exports.</p>
              </div>
              <UsagePanel
                aiInterfacesEnabled={aiInterfacesEnabled}
                busy={busy}
                jobs={jobs}
                aiFeature={aiFeature}
                aiPrompt={aiPrompt}
                onFeatureChange={setAiFeature}
                onPromptChange={setAiPrompt}
                onCreateAiJob={handleCreateAiJob}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AccountTable({ title, columns, rows, empty }) {
  return (
    <article className="vf-account-table-panel">
      <header>
        <span>Historique</span>
        <h2>{title}</h2>
      </header>
      {rows.length ? (
        <div className="vf-account-table-wrap">
          <table>
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row[0]}-${index}`}>
                  {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vf-account-empty">{empty}</p>
      )}
    </article>
  );
}

function UsagePanel({
  jobs,
  busy,
  aiInterfacesEnabled,
  aiFeature,
  aiPrompt,
  onFeatureChange,
  onPromptChange,
  onCreateAiJob,
}) {
  if (!aiInterfacesEnabled) {
    return (
      <div className="vf-account-usage-stack">
        <article className="vf-account-ai-panel" aria-labelledby="account-activity-title">
          <header>
            <span>Activite</span>
            <h2 id="account-activity-title">Votre activite apparaitra ici.</h2>
          </header>
          <p className="vf-account-empty">
            Les achats et les actions importantes de votre compte seront affiches dans cet espace.
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="vf-account-usage-stack">
      <article className="vf-account-ai-panel" aria-labelledby="ai-job-title">
        <header>
          <span>Creation assistee</span>
          <h2 id="ai-job-title">Nouvelle demande</h2>
        </header>
        <form className="vf-account-ai-form" onSubmit={onCreateAiJob}>
          <label>
            <span>Type</span>
            <select value={aiFeature} onChange={(event) => onFeatureChange(event.target.value)}>
              {aiFeatureOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Prompt</span>
            <textarea
              value={aiPrompt}
              maxLength={1600}
              rows={4}
              onChange={(event) => onPromptChange(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || !aiPrompt.trim()}>
            {busy ? "Traitement..." : "Lancer la demande"}
          </button>
        </form>
      </article>
      <AccountTable
        title="Demandes"
        empty="Aucune demande."
        rows={jobs.map((job) => [
          job.feature || "job",
          job.status || "unknown",
          `${formatNumber(job.capturedCredits || job.estimatedCredits || 0)} credits`,
          safeDate(job.createdAt),
        ])}
        columns={["Type", "Statut", "Cout", "Date"]}
      />
    </div>
  );
}

function BillingPanel({ aiInterfacesEnabled, products, payments, busy, onCheckout }) {
  return (
    <div className="vf-account-billing-stack">
      <article className="vf-account-shop" aria-labelledby="billing-shop-title">
        <header>
          <span>Achat</span>
          <h2 id="billing-shop-title">{aiInterfacesEnabled ? "Acces et packs" : "Acces lifetime"}</h2>
        </header>
        <div className="vf-account-shop-grid">
          {products.map((product) => (
            <button
              key={product.key}
              type="button"
              className="vf-account-shop-item"
              disabled={busy}
              onClick={() => onCheckout(product.key)}
            >
              <strong>{product.label}</strong>
              <span>{product.detail}</span>
            </button>
          ))}
        </div>
      </article>
      <AccountTable
        title="Achats"
        empty="Aucun achat pour le moment."
        rows={payments.map((payment) => [
          formatProductLabel(payment.productType),
          formatPaymentStatus(payment.status),
          safeDate(payment.createdAt),
        ])}
        columns={["Produit", "Statut", "Date"]}
      />
    </div>
  );
}
