import {
    getAuth,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();

// -----------------------------------------------------------------------
// Config : liste des avatars disponibles dans la galerie de la modale.
// Adapte ce nombre si tu ajoutes/retires des fichiers dans /pics/assets/pfp/
// -----------------------------------------------------------------------
const AVATAR_COUNT = 8;
const AVATAR_PATH = (n) => `/pics/assets/pfp/${n}.webp`;
const DEFAULT_AVATAR = AVATAR_PATH(1);

const MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

// -----------------------------------------------------------------------
// Références DOM
// -----------------------------------------------------------------------
const profilePic = document.getElementById("profilePic");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const profileBio = document.getElementById("profileBio");
const profileSince = document.getElementById("profileSince");

const btnEditProfile = document.getElementById("btnEditProfile");
const editOverlay = document.getElementById("editOverlay");
const editClose = document.getElementById("editClose");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");
const editStatus = document.getElementById("editStatus");
const editNameInput = document.getElementById("editNameInput");
const editBioInput = document.getElementById("editBioInput");
const bioCharCount = document.getElementById("bioCharCount");
const avatarGrid = document.getElementById("avatarGrid");

let currentUser = null;
let selectedAvatar = DEFAULT_AVATAR;

// -----------------------------------------------------------------------
// Onglets Compte / Confidentialité
// -----------------------------------------------------------------------
const tabButtons = document.querySelectorAll(".profile-tab-btn");
const tabPanels = document.querySelectorAll(".profile-tab-content");

tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.tab;

        tabButtons.forEach((b) => {
            b.classList.toggle("active", b === btn);
            b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });

        tabPanels.forEach((panel) => {
            panel.classList.toggle("active", panel.dataset.tabPanel === target);
        });
    });
});

// -----------------------------------------------------------------------
// Utilitaires Firestore (via window.__prspkDb / window.__prspkFire,
// exposés par firebase-init.js)
// -----------------------------------------------------------------------
function getFire() {
    return {
        db: window.__prspkDb,
        fns: window.__prspkFire
    };
}

async function fetchUserDoc(uid) {
    const { db, fns } = getFire();
    if (!db || !fns) return null;
    const ref = fns.doc(db, "users", uid);
    const snap = await fns.getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

async function saveUserDoc(uid, data) {
    const { db, fns } = getFire();
    if (!db || !fns) return;
    const ref = fns.doc(db, "users", uid);
    await fns.setDoc(ref, data, { merge: true });
}

// -----------------------------------------------------------------------
// Formatage de la date d'inscription : "Perspikativeur depuis mars 2026"
// -----------------------------------------------------------------------
function formatSince(date) {
    const mois = MOIS_FR[date.getMonth()];
    const annee = date.getFullYear();
    return `Perspikativeur depuis ${mois} ${annee}`;
}

// -----------------------------------------------------------------------
// Rendu de la bio (avec état vide stylé)
// -----------------------------------------------------------------------
function renderBio(bio) {
    const trimmed = (bio || "").trim();
    if (trimmed) {
        profileBio.textContent = trimmed;
        profileBio.classList.remove("is-empty");
    } else {
        profileBio.textContent = "Aucune bio pour l'instant.";
        profileBio.classList.add("is-empty");
    }
}

// -----------------------------------------------------------------------
// Construction de la galerie d'avatars dans la modale
// -----------------------------------------------------------------------
function buildAvatarGrid(selected) {
    avatarGrid.innerHTML = "";
    for (let i = 1; i <= AVATAR_COUNT; i++) {
        const path = AVATAR_PATH(i);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "avatar-choice" + (path === selected ? " is-selected" : "");
        btn.dataset.avatar = path;

        const img = document.createElement("img");
        img.src = path;
        img.alt = `Avatar ${i}`;
        btn.appendChild(img);

        btn.addEventListener("click", () => {
            selectedAvatar = path;
            avatarGrid.querySelectorAll(".avatar-choice").forEach((el) => {
                el.classList.toggle("is-selected", el.dataset.avatar === path);
            });
        });

        avatarGrid.appendChild(btn);
    }
}

// -----------------------------------------------------------------------
// Auth state : chargement du profil
// -----------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "/login";
        return;
    }

    currentUser = user;

    const currentPhoto = user.photoURL || DEFAULT_AVATAR;
    profilePic.src = currentPhoto;
    displayName.textContent = user.displayName || "Utilisateur";
    email.textContent = user.email || "";
    selectedAvatar = currentPhoto;

    // Date d'inscription : on se base sur Firestore si un doc existe déjà,
    // sinon sur la date de création du compte Firebase Auth (metadata),
    // et on la sauvegarde dans Firestore pour qu'elle reste stable.
    let bio = "";
    let createdAt = null;

    try {
        const userDoc = await fetchUserDoc(user.uid);

        if (userDoc && userDoc.bio !== undefined) {
            bio = userDoc.bio;
        }

        if (userDoc && userDoc.createdAt && userDoc.createdAt.toDate) {
            createdAt = userDoc.createdAt.toDate();
        } else {
            // Pas encore de date stockée : on la fixe une bonne fois pour toutes
            createdAt = user.metadata && user.metadata.creationTime
                ? new Date(user.metadata.creationTime)
                : new Date();

            const { fns } = getFire();
            if (fns) {
                await saveUserDoc(user.uid, {
                    createdAt: fns.serverTimestamp()
                });
            }
        }
    } catch (err) {
        console.error("Erreur de chargement du profil Firestore :", err);
        createdAt = user.metadata && user.metadata.creationTime
            ? new Date(user.metadata.creationTime)
            : new Date();
    }

    renderBio(bio);
    profileSince.textContent = formatSince(createdAt);
});

// -----------------------------------------------------------------------
// Modale d'édition
// -----------------------------------------------------------------------
function openEditModal() {
    if (!currentUser) return;

    editNameInput.value = currentUser.displayName || "";
    editBioInput.value = profileBio.classList.contains("is-empty") ? "" : profileBio.textContent;
    bioCharCount.textContent = String(editBioInput.value.length);
    editStatus.textContent = "";
    editStatus.classList.remove("is-error");

    buildAvatarGrid(selectedAvatar);

    editOverlay.classList.add("active");
    document.body.classList.add("menu-open");
}

function closeEditModal() {
    editOverlay.classList.remove("active");
    document.body.classList.remove("menu-open");
}

btnEditProfile.addEventListener("click", openEditModal);
editClose.addEventListener("click", closeEditModal);
editCancelBtn.addEventListener("click", closeEditModal);

editOverlay.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeEditModal();
});

editBioInput.addEventListener("input", () => {
    bioCharCount.textContent = String(editBioInput.value.length);
});

editSaveBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const newName = editNameInput.value.trim();
    const newBio = editBioInput.value.trim();

    if (!newName) {
        editStatus.textContent = "Le nom ne peut pas être vide.";
        editStatus.classList.add("is-error");
        return;
    }

    editSaveBtn.disabled = true;
    editStatus.classList.remove("is-error");
    editStatus.textContent = "Enregistrement…";

    try {
        // Mise à jour du profil Firebase Auth (nom + photo)
        await updateProfile(currentUser, {
            displayName: newName,
            photoURL: selectedAvatar
        });

        // Mise à jour Firestore (bio)
        await saveUserDoc(currentUser.uid, { bio: newBio });

        // Rafraîchissement de l'affichage
        displayName.textContent = newName;
        profilePic.src = selectedAvatar;
        renderBio(newBio);

        editStatus.textContent = "Profil mis à jour ✓";
        setTimeout(closeEditModal, 700);
    } catch (err) {
        console.error("Erreur lors de l'enregistrement du profil :", err);
        editStatus.textContent = "Une erreur est survenue, réessaie.";
        editStatus.classList.add("is-error");
    } finally {
        editSaveBtn.disabled = false;
    }
});
