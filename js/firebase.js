// ============================= FIREBASE - PERSPIKATIVE =============================
// Fichier unique : init app, Firestore, Auth (Google login/logout), exports globaux.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBudMYu4rtSL7GrsX3OMtT8klbBX7h4iTE",
  authDomain: "auth.perspikative.com",
  projectId: "perspikative-app",
  storageBucket: "perspikative-app.firebasestorage.app",
  messagingSenderId: "411164951584",
  appId: "1:411164951584:web:d340b95c22d95668c86845"
};


// =============================
// INIT APP
// =============================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// =============================
// EXPORT GLOBAL (POUR TES SCRIPTS: comments, moderation, etc.)
// =============================
window.__prspkDb = db;
window.__prspkAuth = auth;

window.__prspkFire = {
  collection,
  query,
  where,
  limit,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction
};


// =============================
// DETECTION MOBILE
// (popup Google est peu fiable sur mobile : Safari iOS bloque souvent les popups,
// certains navigateurs Android en WebView perdent le contexte JS pendant le popup.
// On bascule sur signInWithRedirect dans ces cas.)
// =============================
function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}


// =============================
// AUTH (GOOGLE LOGIN)
// =============================
const provider = new GoogleAuthProvider();

window.prspkLogin = function () {
  if (isMobileBrowser()) {
    // Sur mobile on redirige : le retour est géré par getRedirectResult ci-dessous.
    signInWithRedirect(auth, provider).catch(console.error);
  } else {
    signInWithPopup(auth, provider).catch(console.error);
  }
};

window.prspkLogout = function () {
  signOut(auth);
};

// Si on revient d'une redirection mobile, on récupère le résultat explicitement.
// C'est souvent LA cause des "infos manquantes après connexion Google sur mobile" :
// sans ça, on compte uniquement sur onAuthStateChanged qui peut se déclencher
// avant que le token/redirect ne soit pleinement traité par le SDK.
getRedirectResult(auth).catch((err) => {
  console.error("Erreur getRedirectResult:", err);
});


// =============================
// USER GLOBAL + PROMESSE D'ATTENTE
// =============================
// Event existant, conservé pour compatibilité avec le code déjà en place.
// + une promesse globale que n'importe quel script chargé APRÈS peut await,
// au lieu de risquer de manquer l'event si l'auth est déjà résolue avant
// qu'il n'ait eu le temps d'ajouter son listener (source classique de bugs
// intermittents, surtout sur mobile où le timing réseau est plus lent).
let resolveAuthReady;
window.__prspkAuthReady = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  window.__prspkUser = user;

  document.dispatchEvent(
    new CustomEvent("prspk:auth-ready", {
      detail: { user }
    })
  );

  if (resolveAuthReady) {
    resolveAuthReady(user);
    resolveAuthReady = null; // ne resolve qu'une fois, la promesse sert au premier chargement
  }
});


// =============================
// EXPORTS (pour les modules qui importent directement ce fichier)
// =============================
export { app, auth, db };
