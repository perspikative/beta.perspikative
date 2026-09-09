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
    "404", "tartineske", "mentions-legales",
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

// -----------------------------------------------------------------------
// Références DOM — réseaux sociaux
// -----------------------------------------------------------------------
const socialForm = document.getElementById("socialForm");
const socialInstagram = document.getElementById("socialInstagram");
const socialWhatsapp = document.getElementById("socialWhatsapp");
const socialYoutube = document.getElementById("socialYoutube");
const socialStatus = document.getElementById("socialStatus");
const socialSaveBtn = document.getElementById("socialSaveBtn");

// -----------------------------------------------------------------------
// Références DOM — lightbox photo de profil (coverflow)
// -----------------------------------------------------------------------
const btnOpenAvatarLightbox = document.getElementById("btnOpenAvatarLightbox");
const profilePicWrapper = btnOpenAvatarLightbox; // même élément, alias par clarté
const avatarLightbox = document.getElementById("avatarLightbox");
const avatarLightboxClose = document.getElementById("avatarLightboxClose");
const avatarCoverflowTrack = document.getElementById("avatarCoverflowTrack");
const avatarArrowLeft = document.getElementById("avatarArrowLeft");
const avatarArrowRight = document.getElementById("avatarArrowRight");
const avatarLightboxSave = document.getElementById("avatarLightboxSave");

let currentUser = null;
let selectedAvatar = DEFAULT_AVATAR;
let currentUsername = null; // valeur normalisée actuellement enregistrée
let currentUsernameDisplay = null; // casse d'affichage actuellement enregistrée
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
// Réseaux sociaux — stockés dans users/{uid}/socialMedia/links
// Les trois seuls champs utilisés sont : instagram, whatsapp, youtube.
// -----------------------------------------------------------------------
async function fetchSocialMedia(uid) {
    const { db, fns } = getFire();
    if (!db || !fns) return null;

    const ref = fns.doc(db, "users", uid, "socialMedia", "links");
    const snap = await fns.getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

async function saveSocialMedia(uid, { instagram, whatsapp, youtube }) {
    const { db, fns } = getFire();
    if (!db || !fns) throw new Error("Firebase non initialisé");

    const ref = fns.doc(db, "users", uid, "socialMedia", "links");
    await fns.setDoc(ref, {
        instagram,
        whatsapp,
        youtube
    }, { merge: true });
}

function normalizeSocialHandle(raw) {
    const value = (raw || "").trim();
    if (!value) return "";
    return value.startsWith("@") ? value : `@${value}`;
}

function validateSocialMedia(instagram, whatsapp, youtube) {
    const instagramValue = (instagram || "").trim();
    const whatsappValue = (whatsapp || "").trim();
    const youtubeValue = (youtube || "").trim();

    if (instagramValue && !/^@[A-Za-z0-9._]{1,30}$/.test(instagramValue)) {
        return "Le nom Instagram doit être un username commençant par @.";
    }

    if (youtubeValue && !/^@[A-Za-z0-9._-]{1,100}$/.test(youtubeValue)) {
        return "Le nom YouTube doit être un username commençant par @.";
    }

    if (whatsappValue) {
        try {
            const url = new URL(whatsappValue);
            const host = url.hostname.toLowerCase();
            const validHost = host === "wa.me" || host === "whatsapp.com" || host === "www.whatsapp.com";
            if (url.protocol !== "https:" || !validHost) {
                return "Le lien WhatsApp doit être une URL HTTPS WhatsApp valide.";
            }
        } catch {
            return "Le lien WhatsApp n'est pas valide.";
        }
    }

    return null;
}

function setSocialStatus(message, isError = false) {
    if (!socialStatus) return;
    socialStatus.textContent = message;
    socialStatus.classList.toggle("is-error", isError);
}

async function loadSocialMedia(uid) {
    if (!socialInstagram || !socialWhatsapp || !socialYoutube) return;

    const socialDoc = await fetchSocialMedia(uid);

    socialInstagram.value = socialDoc?.instagram || "";
    socialWhatsapp.value = socialDoc?.whatsapp || "";
    socialYoutube.value = socialDoc?.youtube || "";
}

// -----------------------------------------------------------------------
// Profil public minimal (username + usernameDisplay + photoURL uniquement,
// JAMAIS displayName), lisible par tout le monde même si le profil complet
// (users/{uid}) est privé. C'est ce document que script-comments.js et
// public-profile.js consultent pour garder pseudo/@/photo à jour, quel que
// soit isPublic.
// -----------------------------------------------------------------------
async function syncPublicProfile(uid, { photoURL, username, usernameDisplay } = {}) {
    const { db, fns } = getFire();
    if (!db || !fns) return;

    const ref = fns.doc(db, "publicProfiles", uid);
    const data = {};

    if (photoURL !== undefined) data.photoURL = photoURL;
    if (username !== undefined) data.username = username;
    if (usernameDisplay !== undefined) data.usernameDisplay = usernameDisplay;

    await fns.setDoc(ref, data, { merge: true });
}

// -----------------------------------------------------------------------
// Username
// -----------------------------------------------------------------------
function normalizeUsername(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/^@+/, "");
}

function validateUsernameFormat(username) {
    if (!username) return "Le nom d'utilisateur ne peut pas être vide.";

    if (!USERNAME_REGEX.test(username)) {
        return "3 à 20 caractères : lettres minuscules, chiffres et _ uniquement.";
    }

    if (RESERVED_USERNAMES.has(username)) {
        return "Ce nom d'utilisateur est réservé.";
    }

    return null;
}

async function isUsernameTaken(username, ownUid = null) {
    const { db, fns } = getFire();
    if (!db || !fns) return false;

    const ref = fns.doc(db, "usernames", username);
    const snap = await fns.getDoc(ref);

    if (!snap.exists()) return false;

    const data = snap.data();

    if (ownUid && data.uid === ownUid) {
        return false;
    }

    return true;
}

async function reserveUsername(uid, username) {
    const { db, fns } = getFire();
    if (!db || !fns) {
        throw new Error("Firebase non initialisé.");
    }

    const ref = fns.doc(db, "usernames", username);
    const snap = await fns.getDoc(ref);

    if (snap.exists()) {
        const data = snap.data();

        if (data.uid !== uid) {
            throw new Error("USERNAME_TAKEN");
        }

        return;
    }

    await fns.setDoc(ref, {
        uid
    });
}

async function releaseUsername(username, uid) {
    if (!username) return;

    const { db, fns } = getFire();
    if (!db || !fns) return;

    const ref = fns.doc(db, "usernames", username);
    const snap = await fns.getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    if (data.uid !== uid) return;

    await fns.deleteDoc(ref);
}

// -----------------------------------------------------------------------
// Helpers d'affichage
// -----------------------------------------------------------------------
function setRealText(element, text) {
    if (!element) return;

    const realText = element.querySelector(".real-text");

    if (realText) {
        realText.textContent = text;
    } else {
        element.textContent = text;
    }
}

function getRealText(element) {
    if (!element) return "";

    const realText = element.querySelector(".real-text");

    return realText
        ? realText.textContent
        : element.textContent;
}

function markLoaded(element) {
    if (!element) return;
    element.classList.add("is-loaded");
}

function renderBio(bio) {
    const value = (bio || "").trim();

    if (!value) {
        profileBio.classList.add("is-empty");
        setRealText(profileBio, "Aucune bio pour l'instant.");
    } else {
        profileBio.classList.remove("is-empty");
        setRealText(profileBio, value);
    }

    markLoaded(profileBio);
}

function renderUsername(username) {
    if (!profileUsername) return;

    if (username) {
        profileUsername.textContent = `@${username}`;
        profileUsername.hidden = false;
    } else {
        profileUsername.textContent = "";
        profileUsername.hidden = true;
    }
}

function renderPublicUrl(username) {
    if (!publicUrlValue) return;

    if (!username) {
        publicUrlValue.textContent = "—";

        if (btnViewPublicProfile) {
            btnViewPublicProfile.removeAttribute("href");
            btnViewPublicProfile.classList.add("is-disabled");
        }

        return;
    }

    publicUrlValue.textContent = `perspikative.com/@${username}`;

    if (btnViewPublicProfile) {
        btnViewPublicProfile.href = `/@${username}`;
        btnViewPublicProfile.classList.remove("is-disabled");
    }
}

function setVisibilityUI(isPublic) {
    if (!visibilityForm) return;

    const radios = visibilityForm.querySelectorAll(
        'input[name="visibility"]'
    );

    radios.forEach((radio) => {
        radio.checked = (
            radio.value === "public" && isPublic
        ) || (
            radio.value === "private" && !isPublic
        );
    });
}

function formatSince(date) {
    const month = MOIS_FR[date.getMonth()];
    const year = date.getFullYear();

    return `Perspikativeur depuis ${month} ${year}`;
}

// -----------------------------------------------------------------------
// Chargement du profil
// -----------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.href = "/login";
        return;
    }

    currentUser = user;

    setRealText(displayName, user.displayName || "Utilisateur");
    markLoaded(displayName);

    if (email) {
        email.textContent = user.email || "";
    }

    setRealText(accountEmail, user.email || "—");
    markLoaded(accountEmail);

    setRealText(accountId, user.uid);
    markLoaded(accountId);

    const { db, fns } = getFire();

    const publicProfilePromise = (db && fns)
        ? fns.getDoc(
            fns.doc(db, "publicProfiles", user.uid)
        ).catch((err) => {
            console.error(
                "Erreur de chargement du profil public :",
                err
            );
            return null;
        })
        : Promise.resolve(null);

    const userDocPromise = fetchUserDoc(user.uid).catch((err) => {
        console.error(
            "Erreur de chargement du profil Firestore :",
            err
        );
        return null;
    });

    const socialMediaPromise = fetchSocialMedia(user.uid).catch((err) => {
        console.error(
            "Erreur de chargement des réseaux sociaux :",
            err
        );
        return null;
    });

    const [
        publicSnap,
        userDoc,
        socialDoc
    ] = await Promise.all([
        publicProfilePromise,
        userDocPromise,
        socialMediaPromise
    ]);

    if (socialInstagram) {
        socialInstagram.value = socialDoc?.instagram || "";
    }

    if (socialWhatsapp) {
        socialWhatsapp.value = socialDoc?.whatsapp || "";
    }

    if (socialYoutube) {
        socialYoutube.value = socialDoc?.youtube || "";
    }

    const storedPhoto =
        publicSnap && publicSnap.exists()
            ? publicSnap.data().photoURL
            : null;

    const currentPhoto =
        storedPhoto || DEFAULT_AVATAR;

    if (profilePic) {
        profilePic.src = currentPhoto;
        profilePic.classList.add("is-loaded");
    }

    selectedAvatar = currentPhoto;

    let bio = "";
    let createdAt = null;
    let usernameDisplay = null;
    let isPublic = false;

    try {
        if (userDoc && userDoc.bio !== undefined) {
            bio = userDoc.bio;
        }

        if (userDoc && userDoc.username) {
            currentUsername = userDoc.username;

            usernameDisplay =
                userDoc.usernameDisplay ||
                userDoc.username;

            currentUsernameDisplay = usernameDisplay;

            syncPublicProfile(user.uid, {
                username: currentUsername,
                usernameDisplay
            }).catch(function (err) {
                console.error(
                    "Erreur de synchro username publicProfiles :",
                    err
                );
            });
        }

        if (userDoc && typeof userDoc.isPublic === "boolean") {
            isPublic = userDoc.isPublic;
        }

        if (
            userDoc &&
            userDoc.createdAt &&
            userDoc.createdAt.toDate
        ) {
            createdAt = userDoc.createdAt.toDate();
        } else {
            createdAt =
                user.metadata &&
                user.metadata.creationTime
                    ? new Date(user.metadata.creationTime)
                    : new Date();

            if (fns) {
                await saveUserDoc(user.uid, {
                    createdAt: fns.serverTimestamp()
                });
            }
        }

    } catch (err) {
        console.error(
            "Erreur de traitement du profil Firestore :",
            err
        );

        createdAt =
            user.metadata &&
            user.metadata.creationTime
                ? new Date(user.metadata.creationTime)
                : new Date();
    }

    renderBio(bio);
    renderUsername(currentUsername);
    renderPublicUrl(currentUsername);
    setVisibilityUI(isPublic);

    if (profileSince) {
        profileSince.textContent = formatSince(createdAt);
    }
});

// -----------------------------------------------------------------------
// Modale d'édition
// -----------------------------------------------------------------------
function openEditModal() {
    if (!currentUser) return;

    // "Nom affiché" (editNameInput) pilote usernameDisplay dans Firestore —
    // totalement indépendant du "Nom d'utilisateur" (editUsernameInput, le
    // @). On pré-remplit donc avec currentUsernameDisplay, pas avec le
    // displayName Firebase Auth.
    editNameInput.value =
        currentUsernameDisplay ||
        currentUser.displayName ||
        "";

    editUsernameInput.value =
        currentUsername ||
        "";

    editUsernameStatus.textContent = "";

    editUsernameStatus.classList.remove(
        "is-error",
        "is-ok"
    );

    editBioInput.value =
        profileBio.classList.contains("is-empty")
            ? ""
            : getRealText(profileBio);

    bioCharCount.textContent =
        String(editBioInput.value.length);

    editStatus.textContent = "";

    editStatus.classList.remove("is-error");

    editOverlay.classList.add("active");
    document.body.classList.add("menu-open");
}

function closeEditModal() {
    editOverlay.classList.remove("active");
    document.body.classList.remove("menu-open");
}

btnEditProfile.addEventListener(
    "click",
    openEditModal
);

editClose.addEventListener(
    "click",
    closeEditModal
);

editCancelBtn.addEventListener(
    "click",
    closeEditModal
);

editOverlay.addEventListener("click", (e) => {
    if (e.target === editOverlay) {
        closeEditModal();
    }
});

editBioInput.addEventListener("input", () => {
    bioCharCount.textContent =
        String(editBioInput.value.length);
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

        const formatError =
            validateUsernameFormat(normalized);

        if (formatError) {
            editUsernameStatus.textContent =
                formatError;

            editUsernameStatus.classList.add(
                "is-error"
            );

            editUsernameStatus.classList.remove(
                "is-ok"
            );

            return;
        }

        if (normalized === currentUsername) {
            editUsernameStatus.textContent =
                "C'est déjà ton nom d'utilisateur actuel.";

            editUsernameStatus.classList.remove(
                "is-error"
            );

            editUsernameStatus.classList.add(
                "is-ok"
            );

            return;
        }

        editUsernameStatus.textContent =
            "Vérification…";

        editUsernameStatus.classList.remove(
            "is-error",
            "is-ok"
        );

        const token = ++usernameCheckToken;

        usernameDebounceTimer = setTimeout(
            async () => {
                try {
                    const taken =
                        await isUsernameTaken(
                            normalized,
                            currentUser
                                ? currentUser.uid
                                : null
                        );

                    if (
                        token !== usernameCheckToken
                    ) {
                        return;
                    }

                    if (taken) {
                        editUsernameStatus.textContent =
                            "Ce nom d'utilisateur est déjà pris.";

                        editUsernameStatus.classList.add(
                            "is-error"
                        );

                        editUsernameStatus.classList.remove(
                            "is-ok"
                        );
                    } else {
                        editUsernameStatus.textContent =
                            "Disponible ✓";

                        editUsernameStatus.classList.add(
                            "is-ok"
                        );

                        editUsernameStatus.classList.remove(
                            "is-error"
                        );
                    }

                } catch (err) {
                    console.error(
                        "Erreur de vérification du username :",
                        err
                    );

                    if (
                        token !== usernameCheckToken
                    ) {
                        return;
                    }

                    editUsernameStatus.textContent =
                        "Impossible de vérifier pour l'instant.";

                    editUsernameStatus.classList.add(
                        "is-error"
                    );
                }
            },
            450
        );
    });
}

editSaveBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const newName =
        editNameInput.value.trim();

    const newBio =
        editBioInput.value.trim();

    const rawUsername =
        editUsernameInput
            ? editUsernameInput.value
            : "";

    const normalizedUsername =
        normalizeUsername(rawUsername);

    if (!newName) {
        editStatus.textContent =
            "Le nom ne peut pas être vide.";

        editStatus.classList.add(
            "is-error"
        );

        return;
    }

    const formatError =
        validateUsernameFormat(
            normalizedUsername
        );

    if (formatError) {
        editUsernameStatus.textContent =
            formatError;

        editUsernameStatus.classList.add(
            "is-error"
        );

        editUsernameStatus.classList.remove(
            "is-ok"
        );

        return;
    }

    const usernameChanged =
        normalizedUsername !== currentUsername;

    if (usernameChanged) {
        const taken =
            await isUsernameTaken(
                normalizedUsername,
                currentUser.uid
            );

        if (taken) {
            editUsernameStatus.textContent =
                "Ce nom d'utilisateur est déjà pris.";

            editUsernameStatus.classList.add(
                "is-error"
            );

            editUsernameStatus.classList.remove(
                "is-ok"
            );

            return;
        }
    }

    editSaveBtn.disabled = true;

    editStatus.textContent =
        "Enregistrement…";

    editStatus.classList.remove(
        "is-error"
    );

    try {
        if (usernameChanged) {
            await reserveUsername(
                currentUser.uid,
                normalizedUsername
            );
        }

        await updateProfile(currentUser, {
            displayName: newName
        });

        await saveUserDoc(
            currentUser.uid,
            {
                username: normalizedUsername,
                usernameDisplay: newName,
                bio: newBio,
                updatedAt: fns?.serverTimestamp
                    ? fns.serverTimestamp()
                    : new Date()
            }
        );

        await syncPublicProfile(
            currentUser.uid,
            {
                username: normalizedUsername,
                usernameDisplay: newName
            }
        );

        if (
            usernameChanged &&
            currentUsername
        ) {
            await releaseUsername(
                currentUsername,
                currentUser.uid
            );
        }

        currentUsername =
            normalizedUsername;

        currentUsernameDisplay =
            newName;

        setRealText(
            displayName,
            newName
        );

        markLoaded(displayName);

        renderUsername(
            normalizedUsername
        );

        renderPublicUrl(
            normalizedUsername
        );

        renderBio(newBio);

        editStatus.textContent =
            "Profil enregistré !";

        setTimeout(() => {
            closeEditModal();
        }, 700);

    } catch (err) {
        console.error(
            "Erreur sauvegarde profil :",
            err
        );

        if (
            err &&
            err.message === "USERNAME_TAKEN"
        ) {
            editStatus.textContent =
                "Ce nom d'utilisateur est déjà pris.";
        } else {
            editStatus.textContent =
                "Une erreur est survenue.";
        }

        editStatus.classList.add(
            "is-error"
        );
    } finally {
        editSaveBtn.disabled = false;
    }
});

// -----------------------------------------------------------------------
// Sauvegarde des réseaux sociaux
// -----------------------------------------------------------------------
if (socialForm) {
    socialForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            if (!currentUser) return;

            const instagram =
                normalizeSocialHandle(
                    socialInstagram
                        ? socialInstagram.value
                        : ""
                );

            const whatsapp =
                socialWhatsapp
                    ? socialWhatsapp.value.trim()
                    : "";

            const youtube =
                normalizeSocialHandle(
                    socialYoutube
                        ? socialYoutube.value
                        : ""
                );

            const validationError =
                validateSocialMedia(
                    instagram,
                    whatsapp,
                    youtube
                );

            if (validationError) {
                setSocialStatus(
                    validationError,
                    true
                );

                return;
            }

            socialSaveBtn.disabled = true;

            setSocialStatus(
                "Enregistrement…"
            );

            try {
                await saveSocialMedia(
                    currentUser.uid,
                    {
                        instagram,
                        whatsapp,
                        youtube
                    }
                );

                if (socialInstagram) {
                    socialInstagram.value =
                        instagram;
                }

                if (socialWhatsapp) {
                    socialWhatsapp.value =
                        whatsapp;
                }

                if (socialYoutube) {
                    socialYoutube.value =
                        youtube;
                }

                setSocialStatus(
                    "Réseaux sociaux enregistrés !"
                );

            } catch (err) {
                console.error(
                    "Erreur sauvegarde réseaux sociaux :",
                    err
                );

                setSocialStatus(
                    "Impossible d'enregistrer les réseaux sociaux.",
                    true
                );

            } finally {
                socialSaveBtn.disabled = false;
            }
        }
    );
}

// -----------------------------------------------------------------------
// Visibilité du profil
// -----------------------------------------------------------------------
if (visibilityForm) {
    visibilityForm.addEventListener(
        "change",
        async (event) => {
            if (!currentUser) return;

            const input =
                event.target.closest(
                    'input[name="visibility"]'
                );

            if (!input) return;

            const isPublic =
                input.value === "public";

            visibilityStatus.textContent =
                "Enregistrement…";

            visibilityStatus.classList.remove(
                "is-error"
            );

            try {
                await saveUserDoc(
                    currentUser.uid,
                    {
                        isPublic,
                        updatedAt:
                            fns?.serverTimestamp
                                ? fns.serverTimestamp()
                                : new Date()
                    }
                );

                visibilityStatus.textContent =
                    isPublic
                        ? "Profil public."
                        : "Profil privé.";

            } catch (err) {
                console.error(
                    "Erreur changement visibilité :",
                    err
                );

                visibilityStatus.textContent =
                    "Impossible de modifier la visibilité.";

                visibilityStatus.classList.add(
                    "is-error"
                );

                setVisibilityUI(
                    !isPublic
                );
            }
        }
    );
}

// -----------------------------------------------------------------------
// Déconnexion
// -----------------------------------------------------------------------
if (btnLogout) {
    btnLogout.addEventListener(
        "click",
        async () => {
            try {
                await signOut(auth);
                window.location.href =
                    "/login";
            } catch (err) {
                console.error(
                    "Erreur de déconnexion :",
                    err
                );
            }
        }
    );
}

// -----------------------------------------------------------------------
// Lightbox avatar
// -----------------------------------------------------------------------
let avatarItems = [];
let avatarIndex = 0;

function buildAvatarGallery() {
    if (!avatarCoverflowTrack) return;

    avatarCoverflowTrack.innerHTML = "";
    avatarItems = [];

    for (
        let i = 1;
        i <= AVATAR_COUNT;
        i++
    ) {
        const path =
            AVATAR_PATH(i);

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";
        button.className =
            "avatar-coverflow-item";

        button.dataset.avatar =
            path;

        const image =
            document.createElement(
                "img"
            );

        image.src = path;
        image.alt =
            `Avatar ${i}`;

        button.appendChild(image);

        avatarCoverflowTrack.appendChild(
            button
        );

        avatarItems.push(button);

        button.addEventListener(
            "click",
            () => {
                avatarIndex = i - 1;
                updateAvatarCoverflow();
            }
        );
    }
}

function updateAvatarCoverflow() {
    avatarItems.forEach(
        (item, index) => {
            item.classList.toggle(
                "active",
                index === avatarIndex
            );
        }
    );

    if (
        avatarArrowLeft
    ) {
        avatarArrowLeft.disabled =
            avatarIndex <= 0;
    }

    if (
        avatarArrowRight
    ) {
        avatarArrowRight.disabled =
            avatarIndex >=
            avatarItems.length - 1;
    }

    if (
        avatarItems[avatarIndex]
    ) {
        selectedAvatar =
            avatarItems[
                avatarIndex
            ].dataset.avatar;
    }
}

function openAvatarLightbox() {
    if (!avatarLightbox) return;

    buildAvatarGallery();

    const index =
        avatarItems.findIndex(
            (item) =>
                item.dataset.avatar ===
                selectedAvatar
        );

    avatarIndex =
        index >= 0
            ? index
            : 0;

    updateAvatarCoverflow();

    avatarLightbox.classList.add(
        "active"
    );

    document.body.classList.add(
        "menu-open"
    );
}

function closeAvatarLightbox() {
    if (!avatarLightbox) return;

    avatarLightbox.classList.remove(
        "active"
    );

    document.body.classList.remove(
        "menu-open"
    );
}

if (btnOpenAvatarLightbox) {
    btnOpenAvatarLightbox.addEventListener(
        "click",
        openAvatarLightbox
    );
}

if (avatarLightboxClose) {
    avatarLightboxClose.addEventListener(
        "click",
        closeAvatarLightbox
    );
}

if (avatarArrowLeft) {
    avatarArrowLeft.addEventListener(
        "click",
        () => {
            if (avatarIndex <= 0) return;

            avatarIndex--;
            updateAvatarCoverflow();
        }
    );
}

if (avatarArrowRight) {
    avatarArrowRight.addEventListener(
        "click",
        () => {
            if (
                avatarIndex >=
                avatarItems.length - 1
            ) {
                return;
            }

            avatarIndex++;
            updateAvatarCoverflow();
        }
    );
}

if (avatarLightbox) {
    avatarLightbox.addEventListener(
        "click",
        (event) => {
            if (
                event.target ===
                avatarLightbox
            ) {
                closeAvatarLightbox();
            }
        }
    );
}

// -----------------------------------------------------------------------
// Navigation clavier lightbox
// -----------------------------------------------------------------------
document.addEventListener(
    "keydown",
    (event) => {
        if (
            !avatarLightbox ||
            !avatarLightbox.classList.contains(
                "active"
            )
        ) {
            return;
        }

        if (event.key === "Escape") {
            closeAvatarLightbox();
            return;
        }

        if (event.key === "ArrowLeft") {
            if (avatarIndex > 0) {
                avatarIndex--;
                updateAvatarCoverflow();
            }
        }

        if (event.key === "ArrowRight") {
            if (
                avatarIndex <
                avatarItems.length - 1
            ) {
                avatarIndex++;
                updateAvatarCoverflow();
            }
        }
    }
);