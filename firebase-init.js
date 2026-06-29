// =============================
// FIREBASE INIT - PERSPIKATIVE
// =============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,       // 🆕 Ajouté pour enregistrer les likes
  onSnapshot    // 🆕 Ajouté pour synchroniser les likes en temps réel
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyBudMYu4rtSL7GrsX3OMtT8klbBX7h4iTE",
  authDomain: "perspikative-app.firebaseapp.com",
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
// EXPORT GLOBAL (POUR TON SCRIPT COMMENTS)
// =============================
window.__prspkDb = db;

window.__prspkFire = {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,       // 🆕 Mis à disposition globalement
  onSnapshot    // 🆕 Mis à disposition globalement
};


// =============================
// AUTH (GOOGLE LOGIN SIMPLE)
// =============================
const provider = new GoogleAuthProvider();

// 👤 Écouteur d'état d'authentification pour la synchronisation
onAuthStateChanged(auth, (user) => {
  window.__prspkUser = user;
  document.dispatchEvent(new CustomEvent('prspk:auth-ready', {
    detail: { user }
  }));
});

// Export optionnel des fonctions d'auth si tu en as besoin ailleurs
window.__prspkAuth = {
  auth,
  provider,
  signInWithGoogle: () => signInWithPopup(auth, provider),
  logout: () => signOut(auth)
};