"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "../../lib/firebase.js";
import { useAiLaunchSettings } from "../../hooks/useAiLaunchSettings.js";
import PublicationComposer from "./components/PublicationComposer";
import { normalizeVibeFxDraft } from "./helpers/publicationHelpers";
import VibeFxStudio from "../vibefx-studio";

/*
 * `initialDraft` et `layoutHref` (phase F, bascule VibeOS): la page /publier
 * monte ce composant avec un rendu deja pret et renvoie « Modifier le visuel »
 * vers le nouvel ecran Mise en page. Sans ces props, le comportement est
 * exactement celui d'avant.
 */
export default function PublicationsManager({ initialMode = "dashboard", initialWorkspace = "studio", initialDraft = null, layoutHref = null }) {
  const { aiInterfacesEnabled } = useAiLaunchSettings();
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(initialMode);
  const [layoutInitialView, setLayoutInitialView] = useState(initialWorkspace);
  const [draft, setDraft] = useState(() => (initialDraft ? normalizeVibeFxDraft(initialDraft) : null));
  const [selectedPublication, setSelectedPublication] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [accountData, setAccountData] = useState({ profile: null, payments: [], checkouts: [], jobs: [] });
  const [authLoading, setAuthLoading] = useState(Boolean(auth));
  const [authError, setAuthError] = useState(auth ? "" : "Firebase Auth n'est pas initialise.");
  const currentUid = currentUser?.uid || "";

  const loadPublications = useCallback(async () => {
    setLoading(true);
    try {
      if (!db || !currentUid) {
        setPublications([]);
        return;
      }

      const snapshot = await getDocs(query(
        collection(db, "publications"),
        where("ownerUid", "==", currentUid),
        orderBy("updatedAt", "desc")
      ));
      setPublications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error("Publications load error:", error);
      setPublications([]);
    } finally {
      setLoading(false);
    }
  }, [currentUid]);

  const loadAccountData = useCallback(async () => {
    if (!db || !currentUid) {
      setAccountData({ profile: null, payments: [], checkouts: [], jobs: [] });
      return;
    }

    const jobQuery = aiInterfacesEnabled
      ? getDocs(query(
        collection(db, "aiJobs"),
        where("uid", "==", currentUid),
        orderBy("createdAt", "desc"),
        limit(4)
      )).catch(() => ({ docs: [] }))
      : Promise.resolve({ docs: [] });

    const [profileSnapshot, paymentSnapshot, checkoutSnapshot, jobSnapshot] = await Promise.all([
      getDoc(doc(db, "users", currentUid)).catch(() => null),
      getDocs(query(
        collection(db, "payments"),
        where("uid", "==", currentUid),
        orderBy("createdAt", "desc"),
        limit(4)
      )).catch(() => ({ docs: [] })),
      getDocs(query(
        collection(db, "checkoutSessions"),
        where("uid", "==", currentUid),
        orderBy("updatedAt", "desc"),
        limit(4)
      )).catch(() => ({ docs: [] })),
      jobQuery,
    ]);

    setAccountData({
      profile: profileSnapshot?.exists?.() ? profileSnapshot.data() : null,
      payments: paymentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      checkouts: checkoutSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
      jobs: jobSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
    });
  }, [aiInterfacesEnabled, currentUid]);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthLoading(false);
        setAuthError("");
        return;
      }

      setAuthLoading(true);
      try {
        const credential = await signInAnonymously(auth);
        setCurrentUser(credential.user);
        setAuthError("");
      } catch (error) {
        console.error("Anonymous auth error:", error);
        setCurrentUser(null);
        setAuthError(error.message || "Connexion anonyme Firebase indisponible.");
      } finally {
        setAuthLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    const timer = window.setTimeout(() => {
      void loadPublications();
      void loadAccountData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, loadAccountData, loadPublications]);

  const handleImport = (payload) => {
    setDraft(normalizeVibeFxDraft(payload));
    setSelectedPublication(null);
    setMode("publish");
  };

  const openLayoutFromPublications = () => {
    if (layoutHref) {
      window.location.href = layoutHref;
      return;
    }
    setLayoutInitialView("layout");
    setMode("layout");
  };

  const handleSelectPublication = (publication) => {
    setSelectedPublication(publication);
    setDraft(null);
  };

  const handleDelete = async (publication) => {
    if (!window.confirm(`Supprimer "${publication.title || "cette publication"}" ?`)) return;
    await deleteDoc(doc(db, "publications", publication.id));
    if (selectedPublication?.id === publication.id) setSelectedPublication(null);
    await loadPublications();
  };

  const handleSetHomeFeature = async (publicationId) => {
    const updates = publications
      .filter((item) => item.featured || item.id === publicationId)
      .map((item) => updateDoc(doc(db, "publications", item.id), {
        featured: item.id === publicationId,
        updatedAt: serverTimestamp(),
      }));

    await Promise.all(updates);
    setSelectedPublication((current) => current ? { ...current, featured: current.id === publicationId } : current);
    await loadPublications();
  };

  const handleSavedPublication = (publication) => {
    setSelectedPublication(publication);
    setDraft(null);
    setPublications((current) => {
      const withoutSaved = current.filter((item) => item.id !== publication.id);
      const normalized = publication.featured
        ? withoutSaved.map((item) => ({ ...item, featured: false }))
        : withoutSaved;
      return [publication, ...normalized];
    });
  };

  return (
    <div className={`pub-manager vfx-mode ${mode === "layout" ? "is-layout" : "is-publish"}`}>
      {mode === "layout" ? (
        <div className="pub-layout-fullscreen">
          <VibeFxStudio
            initialView={layoutInitialView}
            publicationsCount={publications.length}
            onOpenPublications={() => {
              setLayoutInitialView("studio");
              setMode("dashboard");
            }}
            onImportToPublication={handleImport}
          />
        </div>
      ) : (
        <PublicationComposer
          draft={draft}
          publication={selectedPublication}
          publications={publications}
          loading={loading || authLoading}
          authError={authError}
          currentUser={currentUser}
          accountData={accountData}
          aiInterfacesEnabled={aiInterfacesEnabled}
          onBackToLayout={openLayoutFromPublications}
          onSelectPublication={handleSelectPublication}
          onDeletePublication={handleDelete}
          onSetHomeFeature={handleSetHomeFeature}
          onSaved={handleSavedPublication}
        />
      )}
    </div>
  );
}
