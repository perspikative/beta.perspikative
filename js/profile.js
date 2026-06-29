import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

let currentUserUID = null;

const usernameInput = document.getElementById("username");
const displayNameInput = document.getElementById("displayName");
const bioInput = document.getElementById("bio");
const photo = document.getElementById("photo");
const saveBtn = document.getElementById("saveBtn");

// 🔐 Check user login
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Pas connecté");
    return;
  }

  currentUserUID = user.uid;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();

    usernameInput.value = data.username || "";
    displayNameInput.value = data.displayName || "";
    bioInput.value = data.bio || "";
    photo.src = data.photoURL || "https://via.placeholder.com/80";
  }
});

// 💾 Save changes
saveBtn.addEventListener("click", async () => {
  if (!currentUserUID) return;

  const ref = doc(db, "users", currentUserUID);

  await updateDoc(ref, {
    username: usernameInput.value.trim(),
    displayName: displayNameInput.value.trim(),
    bio: bioInput.value.trim()
  });

  alert("Profil mis à jour !");
});