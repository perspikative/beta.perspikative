import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBudMYu4rtSL7GrsX3OMtT8klbBX7h4iTE",
  authDomain: "perspikative-app.firebaseapp.com",
  projectId: "perspikative-app",
  storageBucket: "perspikative-app.firebasestorage.app",
  messagingSenderId: "411164951584",
  appId: "1:411164951584:web:d340b95c22d95668c86845"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🔥 GLOBAL pour ton script comments
window.__prspkDb = db;
window.__prspkFire = {
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  arrayUnion,
  serverTimestamp,
  Timestamp
};

// 👤 Auth globale
onAuthStateChanged(auth, (user) => {
  window.__prspkUser = user;
  document.dispatchEvent(new CustomEvent('prspk:auth-ready', {
    detail: { user }
  }));
});
