"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext(null);
const makeMockUser = () => ({
  uid: "mock-user-id",
  email: "dev@vibefx.app",
  displayName: "Développeur local",
  emailVerified: true,
});

// URL vers laquelle Firebase redirige après verification mail
const getActionCodeSettings = () => ({
  url: typeof window !== "undefined"
    ? `${window.location.origin}/creer/layout-visuel`
    : "https://vibefx-v2-web--vibefx-v2.europe-west4.hosted.app/creer/layout-visuel",
  handleCodeInApp: false,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [googleAuthReady, setGoogleAuthReady] = useState(!auth);
  const devAuthBypassRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      return;
    }

    /*
     * Firebase initialise son resolver popup de facon asynchrone au premier
     * appel. Safari peut alors considerer que window.open ne vient plus du
     * clic utilisateur et bloquer la fenetre. getRedirectResult initialise le
     * meme resolver au chargement, avant que le bouton Google soit activable.
     * Il est sans effet quand aucun retour de redirection n'est en attente.
     */
    let active = true;
    getRedirectResult(auth)
      .catch((error) => {
        console.error("Google auth initialization error:", error?.code || error);
      })
      .finally(() => {
        if (active) setGoogleAuthReady(true);
      });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || (devAuthBypassRef.current ? makeMockUser() : null));
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return null;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  }, []);

  // Créer un compte email + envoyer mail de vérification
  const signUpWithEmail = useCallback(async (email, password) => {
    if (!auth) throw new Error("Firebase Auth indisponible.");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user, getActionCodeSettings());
    return credential.user;
  }, []);

  // Connexion email/mot de passe existant
  const signInWithEmail = useCallback(async (email, password) => {
    if (!auth) throw new Error("Firebase Auth indisponible.");
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }, []);

  // Renvoyer l'email de vérification
  const resendVerificationEmail = useCallback(async () => {
    if (!auth?.currentUser) return;
    await sendEmailVerification(auth.currentUser, getActionCodeSettings());
  }, []);

  const logout = useCallback(async () => {
    devAuthBypassRef.current = false;
    setUser(null);
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout error:", e);
    }
  }, []);

  const loginAsMockUser = useCallback(() => {
    if (process.env.NODE_ENV !== "development") return;
    devAuthBypassRef.current = true;
    setUser(makeMockUser());
    setLoading(false);
  }, []);

  const isAnonymous = user?.isAnonymous === true;
  const isSignedIn = Boolean(user && !isAnonymous);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAnonymous,
      isSignedIn,
      googleAuthReady,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      resendVerificationEmail,
      logout,
      loginAsMockUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
