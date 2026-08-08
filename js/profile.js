import {
    getAuth,
    onAuthStateChanged,
    updateProfile,
    signOut,
    deleteUser
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
// Usernames réservés — garde cette liste synchronisée avec les règles
// Firestore (voir security rules) qui font aussi cette vérification côté
// serveur pour ne jamais dépendre uniquement du client.
// -----------------------------------------------------------------------
const RESERVED_USERNAMES = new Set([
    "login", "profile", "account", "admin", "search", "rechercher",
    "portfolio", "creations", "illustrations", "projets", "commu",
    "actus", "about", "beta", "help", "help-center", "contact", "api",
    "404", "tartineske", "perspikative", "mentions-legales",
    "politique-de-confidentialite", "terms-of-service", "position-ia",
    "brand-guidelines", "art-challenge", "www", "assets", "static",
    "settings", "notifications", "explore", "home", "index"
]);

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// -----------------------------------------------------------------------
// Références DOM — profil (colonne gauche)
// -----------------------------------------------------------------------
const profilePic = document.getElementById("profilePic");
const displayName = document.getElementById("displayName");
const email = document.getElementById("email");
const profileBio = document.getElementById("profileBio");
const profileSince = document.getElementById("profileSince");
const profileUsername = document.getElementById("profileUsername");

const btnEditProfile = document.getElementById("btnEditProfile");
const editOverlay = document.getElementById("editOverlay");
const editClose = document.getElementById("editClose");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");
const editStatus = document.getElementById("editStatus");
const editNameInput = document.getElementById("editNameInput");
const editUsernameInput = document.getElementById("editUsernameInput");
const editUsernameStatus = document.getElementById("editUsernameStatus");
const editBioInput = document.getElementById("editBioInput");
const bioCharCount = document.getElementById("bioCharCount");
const avatarGrid = document.getElementById("avatarGrid");
const btnLogout = document.getElementById("btnLogout");
const accountEmail = document.getElementById("accountEmail");
const accountId = document.getElementById("accountId");
const btnDeleteAccount = document.getElementById("btnDeleteAccount");

// -----------------------------------------------------------------------
// Références DOM — onglet Confidentialité
// -----------------------------------------------------------------------
const publicUrlValue = document.getElementById("publicUrlValue");
const btnViewPublicProfile = document.getElementById("btnViewPublicProfile");
const visibilityForm = document.getElementById("visibilityForm");
const visibilityStatus = document.getElementById("visibilityStatus");

let currentUser = null;
let selectedAvatar = DEFAULT_AVATAR;
let currentUsername = null; // valeur normalisée actuellement enregistrée
let usernameCheckToken = 0; // pour ignorer les réponses de vérif obsolètes

// -----------------------------------------------------------------------
// Onglets Compte / Confidentialité / Sécurité
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
// Username : normalisation, validation, vérification d'unicité
// -----------------------------------------------------------------------
function normalizeUsername(raw) {
    return (raw || "").trim().toLowerCase();
}

function validateUsernameFormat(normalized) {
    if (!normalized) return "Choisis un nom d'utilisateur.";
    if (!USERNAME_REGEX.test(normalized)) {
        return "3 à 20 caractères : lettres minuscules, chiffres et _ uniquement, sans espace.";
    }
    if (RESERVED_USERNAMES.has(normalized)) {
        return "Ce nom d'utilisateur est réservé, choisis-en un autre.";
    }
    return null;
}

// Vérifie que le username n'est pas déjà pris par un AUTRE utilisateur.
// Lit directement usernames/{normalized} : c'est ce document qui fait
// foi pour l'unicité (son ID EST le username). Une lecture simple suffit
// ici pour un feedback instantané ; la garantie réelle contre les races
// vient de la transaction dans saveUsername() plus bas, appliquée à
// l'écriture, pas à cette vérification "live" qui sert juste d'UX.
async function isUsernameTaken(normalized, ownUid) {
    const { db, fns } = getFire();
    if (!db || !fns) return false;

    const ref = fns.doc(db, "usernames", normalized);
    const snap = await fns.getDoc(ref);

    if (!snap.exists()) return false;
    return snap.data().uid !== ownUid;
}

// -----------------------------------------------------------------------
// Réservation atomique du username : dans une seule transaction Firestore,
// on vérifie que le nouveau pseudo est libre, on le réserve, on libère
// l'ancien (s'il y en avait un), et on met à jour users/{uid}. Tout ou
// rien : si un autre utilisateur a pris le pseudo entre-temps, la
// transaction échoue proprement et rien n'est écrit.
// -----------------------------------------------------------------------
async function saveUsername(uid, oldUsername, newUsername, newUsernameDisplay) {
    const { db, fns } = getFire();
    if (!db || !fns) throw new Error("Firebase non initialisé");

    const newRef = fns.doc(db, "usernames", newUsername);
    const userRef = fns.doc(db, "users", uid);
    const oldRef = oldUsername ? fns.doc(db, "usernames", oldUsername) : null;

    await fns.runTransaction(db, async (tx) => {
        const newSnap = await tx.get(newRef);

        if (newSnap.exists() && newSnap.data().uid !== uid) {
            throw new Error("USERNAME_TAKEN");
        }

        tx.set(newRef, { uid });
        if (oldRef && oldUsername !== newUsername) {
            tx.delete(oldRef);
        }
        tx.set(userRef, {
            username: newUsername,
            usernameDisplay: newUsernameDisplay
        }, { merge: true });
    });
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

function renderUsername(usernameDisplay) {
    if (!profileUsername) return;
    if (usernameDisplay) {
        profileUsername.textContent = `@${usernameDisplay}`;
        profileUsername.hidden = false;
    } else {
        profileUsername.textContent = "";
        profileUsername.hidden = true;
    }
}

function renderPublicUrl(usernameDisplay) {
    if (!publicUrlValue) return;
    if (usernameDisplay) {
        const url = `perspikative.com/@${usernameDisplay}`;
        publicUrlValue.textContent = url;
        if (btnViewPublicProfile) {
            btnViewPublicProfile.href = `/@${usernameDisplay}`;
            btnViewPublicProfile.classList.remove("is-disabled");
        }
    } else {
        publicUrlValue.textContent = "Choisis d'abord un nom d'utilisateur";
        if (btnViewPublicProfile) {
            btnViewPublicProfile.removeAttribute("href");
            btnViewPublicProfile.classList.add("is-disabled");
        }
    }
}

function setVisibilityUI(isPublic) {
    if (!visibilityForm) return;
    const radios = visibilityForm.querySelectorAll('input[name="visibility"]');
    radios.forEach((radio) => {
        radio.checked = (radio.value === "public") === isPublic;
    });
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

    // Section Compte : e-mail (2e affichage) + ID Perspikative (UID Firebase)
    accountEmail.textContent = user.email || "—";
    accountId.textContent = user.uid;

    // Date d'inscription : on se base sur Firestore si un doc existe déjà,
    // sinon sur la date de création du compte Firebase Auth (metadata),
    // et on la sauvegarde dans Firestore pour qu'elle reste stable.
    let bio = "";
    let createdAt = null;
    let usernameDisplay = null;
    let isPublic = false;

    try {
        const userDoc = await fetchUserDoc(user.uid);

        if (userDoc && userDoc.bio !== undefined) {
            bio = userDoc.bio;
        }

        if (userDoc && userDoc.username) {
            currentUsername = userDoc.username;
            usernameDisplay = userDoc.usernameDisplay || userDoc.username;
        }

        if (userDoc && typeof userDoc.isPublic === "boolean") {
            isPublic = userDoc.isPublic;
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
    renderUsername(usernameDisplay);
    renderPublicUrl(usernameDisplay);
    setVisibilityUI(isPublic);
    profileSince.textContent = formatSince(createdAt);
});

// -----------------------------------------------------------------------
// Modale d'édition
// -----------------------------------------------------------------------
function openEditModal() {
    if (!currentUser) return;

    editNameInput.value = currentUser.displayName || "";
    editUsernameInput.value = currentUsername || "";
    editUsernameStatus.textContent = "";
    editUsernameStatus.classList.remove("is-error", "is-ok");
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

// -----------------------------------------------------------------------
// Vérification live du username pendant la saisie (debounce simple)
// -----------------------------------------------------------------------
let usernameDebounceTimer = null;

if (editUsernameInput) {
    editUsernameInput.addEventListener("input", () => {
        const raw = editUsernameInput.value;
        const normalized = normalizeUsername(raw);

        clearTimeout(usernameDebounceTimer);

        const formatError = validateUsernameFormat(normalized);
        if (formatError) {
            editUsernameStatus.textContent = formatError;
            editUsernameStatus.classList.add("is-error");
            editUsernameStatus.classList.remove("is-ok");
            return;
        }

        if (normalized === currentUsername) {
            editUsernameStatus.textContent = "C'est déjà ton nom d'utilisateur actuel.";
            editUsernameStatus.classList.remove("is-error");
            editUsernameStatus.classList.add("is-ok");
            return;
        }

        editUsernameStatus.textContent = "Vérification…";
        editUsernameStatus.classList.remove("is-error", "is-ok");

        const token = ++usernameCheckToken;
        usernameDebounceTimer = setTimeout(async () => {
            try {
                const taken = await isUsernameTaken(normalized, currentUser ? currentUser.uid : null);
                if (token !== usernameCheckToken) return; // réponse obsolète

                if (taken) {
                    editUsernameStatus.textContent = "Ce nom d'utilisateur est déjà pris.";
                    editUsernameStatus.classList.add("is-error");
                    editUsernameStatus.classList.remove("is-ok");
                } else {
                    editUsernameStatus.textContent = "Disponible ✓";
                    editUsernameStatus.classList.add("is-ok");
                    editUsernameStatus.classList.remove("is-error");
                }
            } catch (err) {
                console.error("Erreur de vérification du username :", err);
                if (token !== usernameCheckToken) return;
                editUsernameStatus.textContent = "Impossible de vérifier pour l'instant.";
                editUsernameStatus.classList.add("is-error");
            }
        }, 450);
    });
}

editSaveBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const newName = editNameInput.value.trim();
    const newBio = editBioInput.value.trim();
    const rawUsername = editUsernameInput ? editUsernameInput.value : "";
    const normalizedUsername = normalizeUsername(rawUsername);

    if (!newName) {
        editStatus.textContent = "Le nom ne peut pas être vide.";
        editStatus.classList.add("is-error");
        return;
    }

    const formatError = validateUsernameFormat(normalizedUsername);
    if (formatError) {
        editStatus.textContent = formatError;
        editStatus.classList.add("is-error");
        return;
    }

    editSaveBtn.disabled = true;
    editStatus.classList.remove("is-error");
    editStatus.textContent = "Enregistrement…";

    try {
        // Réservation atomique du username (si changé). C'est cette étape,
        // et non une simple vérification préalable, qui garantit qu'on ne
        // peut jamais voler un pseudo pris entre-temps par quelqu'un d'autre.
        if (normalizedUsername !== currentUsername) {
            try {
                await saveUsername(
                    currentUser.uid,
                    currentUsername,
                    normalizedUsername,
                    rawUsername.trim()
                );
            } catch (err) {
                if (err.message === "USERNAME_TAKEN") {
                    editStatus.textContent = "Ce nom d'utilisateur vient d'être pris, choisis-en un autre.";
                    editStatus.classList.add("is-error");
                    editSaveBtn.disabled = false;
                    return;
                }
                throw err;
            }
        }

        // Mise à jour du profil Firebase Auth (nom + photo)
        await updateProfile(currentUser, {
            displayName: newName,
            photoURL: selectedAvatar
        });

        // Mise à jour Firestore (bio uniquement ici : le username a déjà
        // été écrit sur users/{uid} par saveUsername() ci-dessus, dans la
        // même transaction que la réservation).
        await saveUserDoc(currentUser.uid, { bio: newBio });

        // Rafraîchissement de l'affichage
        displayName.textContent = newName;
        profilePic.src = selectedAvatar;
        renderBio(newBio);
        currentUsername = normalizedUsername;
        renderUsername(rawUsername.trim());
        renderPublicUrl(rawUsername.trim());

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

// -----------------------------------------------------------------------
// Onglet Confidentialité : Public / Privé
// -----------------------------------------------------------------------
if (visibilityForm) {
    visibilityForm.addEventListener("change", async (e) => {
        const radio = e.target;
        if (!radio || radio.name !== "visibility") return;
        if (!currentUser) return;

        const wantsPublic = radio.value === "public";

        if (wantsPublic && !currentUsername) {
            visibilityStatus.textContent = "Choisis d'abord un nom d'utilisateur dans l'onglet Compte avant de passer en public.";
            visibilityStatus.classList.add("is-error");
            // On annule visuellement la sélection
            setVisibilityUI(false);
            return;
        }

        visibilityStatus.classList.remove("is-error");
        visibilityStatus.textContent = "Enregistrement…";

        try {
            await saveUserDoc(currentUser.uid, { isPublic: wantsPublic });
            visibilityStatus.textContent = wantsPublic
                ? "Ton profil est maintenant public ✓"
                : "Ton profil est maintenant privé ✓";
            setTimeout(() => { visibilityStatus.textContent = ""; }, 2500);
        } catch (err) {
            console.error("Erreur lors de la mise à jour de la visibilité :", err);
            visibilityStatus.textContent = "Une erreur est survenue, réessaie.";
            visibilityStatus.classList.add("is-error");
            setVisibilityUI(!wantsPublic);
        }
    });
}

// -----------------------------------------------------------------------
// Déconnexion
// -----------------------------------------------------------------------
btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;
    try {
        await signOut(auth);
        window.location.href = "/";
    } catch (err) {
        console.error("Erreur lors de la déconnexion :", err);
        btnLogout.disabled = false;
    }
});

// -----------------------------------------------------------------------
// Suppression du compte
// -----------------------------------------------------------------------
btnDeleteAccount.addEventListener("click", async () => {
    if (!currentUser) return;

    const confirmed = window.confirm(
        "Es-tu sûr de vouloir supprimer définitivement ton compte Perspikative ? Cette action est irréversible."
    );
    if (!confirmed) return;

    btnDeleteAccount.disabled = true;

    try {
        // Nettoyage des données Firestore associées avant suppression du compte Auth
        const { db, fns } = getFire();
        if (db && fns) {
            await fns.deleteDoc(fns.doc(db, "users", currentUser.uid));
        }

        await deleteUser(currentUser);
        window.location.href = "/";
    } catch (err) {
        console.error("Erreur lors de la suppression du compte :", err);

        if (err.code === "auth/requires-recent-login") {
            alert("Pour supprimer ton compte, reconnecte-toi d'abord (dernière connexion trop ancienne), puis réessaie.");
        } else {
            alert("Une erreur est survenue, réessaie plus tard.");
        }
    } finally {
        btnDeleteAccount.disabled = false;
    }
});
