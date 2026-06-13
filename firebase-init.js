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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// =============================
// CONFIG FIREBASE (À REMPLACER)
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyA0qLI25TEj7yVyObLjbDSipsFFm8lFZtY",
  authDomain: "perspikative-26800.firebaseapp.com",
  databaseURL: "https://perspikative-26800-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "perspikative-26800",
  storageBucket: "perspikative-26800.firebasestorage.app",
  messagingSenderId: "520735354440",
  appId: "1:520735354440:web:3607aac59cf6f30c97727d",
  measurementId: "G-V3XJ8020SC"
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
  serverTimestamp
};


// =============================
// AUTH (GOOGLE LOGIN SIMPLE)
// =============================
const provider = new GoogleAuthProvider();

// login function (si tu veux un bouton)
window.prspkLogin = function () {
  signInWithPopup(auth, provider).catch(console.error);
};

window.prspkLogout = function () {
  signOut(auth);
};


// =============================
// USER GLOBAL (ULTRA IMPORTANT)
// =============================
onAuthStateChanged(auth, (user) => {
  window.__prspkUser = user;

  document.dispatchEvent(
    new CustomEvent("prspk:auth-ready", {
      detail: { user }
    })
  );
});