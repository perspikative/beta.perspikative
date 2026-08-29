// ============================= PUBLIC PROFILE (/@username) =============================
// Ce script lit le username dans l'URL réelle du navigateur, cherche le compte
// correspondant dans Firestore, et affiche soit le profil public, soit un état
// "profil privé", soit redirige vers /404 si le username n'existe pas.

const MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

const DEFAULT_AVATAR = "/pics/assets/pfp/1.webp";

// -----------------------------------------------------------------------
// Références DOM
// -----------------------------------------------------------------------
const ppLoading = document.getElementById("ppLoading");
const ppCard = document.getElementById("ppCard");
const ppPrivate = document.getElementById("ppPrivate");

const ppPic = document.getElementById("ppPic");
const ppName = document.getElementById("ppName");
const ppUsername = document.getElementById("ppUsername");
const ppBio = document.getElementById("ppBio");
const ppSince = document.getElementById("ppSince");

// -----------------------------------------------------------------------
// Récupération du username.
//
// Deux cas :
// 1) La personne est arrivée directement sur /@alice : GitHub Pages a servi
//    404.html (aucun fichier ne correspond à /@alice), qui a stocké le
//    chemin d'origine dans sessionStorage avant de rediriger vers /@ (la
//    vraie page Jekyll, celle-ci). On relit cette valeur ici, puis on
//    restaure l'URL propre /@alice dans la barre d'adresse avec
//    history.replaceState pour que le partage/refresh restent cohérents.
// 2) La personne a navigué en interne (lien <a href="/@alice">) : dans ce
//    cas le navigateur charge quand même cette même page (toujours servie
//    en tant que /@ par Jekyll, sauf si un jour on a un vrai routeur SPA),
//    donc on retombe aussi sur le cas 404 ci-dessus au chargement suivant.
// -----------------------------------------------------------------------
function getUsernameFromUrl() {
    // Cas redirection depuis 404.html
    const pending = sessionStorage.getItem("prspk_pending_username_path");
    if (pending) {
        sessionStorage.removeItem("prspk_pending_username_path");

        // Restaure l'URL propre (/@alice) sans recharger la page.
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, "", pending);
        }

        return extractUsername(pending);
    }

    // Cas où l'URL affichée est déjà la bonne (ex: on est resté sur /@alice
    // après le replaceState ci-dessus et le script tourne une 2e fois, ou la
    // page a été rechargée après le replaceState).
    return extractUsername(window.location.pathname);
}

function extractUsername(path) {
    let clean = (path || "").split("?")[0].split("#")[0];
    clean = clean.replace(/\/+$/, ""); // retire un éventuel slash final
    const match = clean.match(/\/@([^/]+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
}

// -----------------------------------------------------------------------
// Normalisation : identique à celle utilisée à l'écriture (voir profile.js)
// -----------------------------------------------------------------------
function normalizeUsername(raw) {
    return (raw || "").trim().toLowerCase();
}

function formatSince(date) {
    const mois = MOIS_FR[date.getMonth()];
    const annee = date.getFullYear();
    return `Perspikativeur depuis ${mois} ${annee}`;
}

function showState(el) {
    [ppLoading, ppCard, ppPrivate].forEach((node) => {
        if (!node) return;
        node.hidden = node !== el;
    });
}

function goTo404() {
    window.location.replace("/404");
}

// -----------------------------------------------------------------------
// Métadonnées SEO / Open Graph : mises à jour dynamiquement une fois
// le profil chargé (limite connue : rendu côté client, voir doc du projet).
// -----------------------------------------------------------------------
function updateMeta({ title, description, image, url, indexable }) {
    document.title = title;
    document.getElementById("pageTitle").textContent = title;

    const desc = document.getElementById("metaDescription");
    if (desc) desc.setAttribute("content", description);

    const ogTitle = document.getElementById("ogTitle");
    if (ogTitle) ogTitle.setAttribute("content", title);

    const ogDesc = document.getElementById("ogDescription");
    if (ogDesc) ogDesc.setAttribute("content", description);

    const ogImage = document.getElementById("ogImage");
    if (ogImage && image) ogImage.setAttribute("content", image);

    const ogUrl = document.getElementById("ogUrl");
    if (ogUrl && url) ogUrl.setAttribute("content", url);

    const canonical = document.getElementById("canonicalLink");
    if (canonical && url) canonical.setAttribute("href", url);

    const robots = document.getElementById("metaRobots");
    if (robots) robots.setAttribute("content", indexable ? "index, follow" : "noindex, follow");
}

// -----------------------------------------------------------------------
// Résolution du username : usernames/{usernameNormalized} contient l'uid
// propriétaire (c'est ce document qui fait foi pour l'unicité, voir
// profile.js et les Firestore rules). On lit ensuite users/{uid} pour les
// données d'affichage complètes.
//
// Cas important : si le profil est privé (isPublic != true), les règles
// Firestore refusent carrément la lecture de users/{uid} pour un visiteur
// non-propriétaire (permission-denied, pas juste un doc vide). On ne peut
// donc PAS distinguer "profil privé" de "n'existe pas" avec cette seule
// lecture. On retombe alors sur publicProfiles/{uid} (toujours lisible)
// pour confirmer que le compte existe bel et bien avant d'afficher l'état
// "Profil privé" plutôt qu'un 404 trompeur.
// -----------------------------------------------------------------------
async function findUserByUsername(usernameNormalized) {
    const db = window.__prspkDb;
    const fns = window.__prspkFire;
    if (!db || !fns) throw new Error("Firebase non initialisé");

    const usernameRef = fns.doc(db, "usernames", usernameNormalized);
    const usernameSnap = await fns.getDoc(usernameRef);

    if (!usernameSnap.exists()) return null;

    const uid = usernameSnap.data().uid;
    if (!uid) return null;

    const userRef = fns.doc(db, "users", uid);

    try {
        const userSnap = await fns.getDoc(userRef);
        if (!userSnap.exists()) return null;

        // users/{uid} ne stocke jamais la photo de profil : c'est
        // publicProfiles/{uid}.photoURL, dans Firestore, qui fait foi
        // partout dans le projet (voir aussi profile.js). On la récupère
        // ici pour que le profil public affiche toujours la photo à jour,
        // y compris quand elle vient d'être changée.
        let photoURL = null;
        try {
            const publicSnap = await fns.getDoc(fns.doc(db, "publicProfiles", uid));
            if (publicSnap.exists()) photoURL = publicSnap.data().photoURL || null;
        } catch (photoErr) {
            console.error("Erreur de lecture de la photo publique :", photoErr);
        }

        return { uid, ...userSnap.data(), photoURL };
    } catch (err) {
        // Lecture refusée : très probablement un profil privé (règle
        // Firestore). On vérifie via publicProfiles/{uid} (toujours
        // lisible) que le compte existe réellement avant de conclure.
        const publicRef = fns.doc(db, "publicProfiles", uid);
        const publicSnap = await fns.getDoc(publicRef).catch(() => null);

        if (publicSnap && publicSnap.exists()) {
            return { uid, isPublic: false, username: usernameNormalized };
        }

        // Ni users/{uid} lisible, ni publicProfiles/{uid} : on ne peut
        // pas confirmer que le compte existe, on remonte l'erreur telle
        // quelle pour que l'appelant décide (404).
        throw err;
    }
}

// -----------------------------------------------------------------------
// Rendu du profil public
// -----------------------------------------------------------------------
function renderPublicProfile(userData) {
    const displayName = userData.displayName || userData.usernameDisplay || userData.username;
    const usernameDisplay = userData.usernameDisplay || userData.username;
    const photo = userData.photoURL || DEFAULT_AVATAR;
    const bio = (userData.bio || "").trim();

    ppPic.src = photo;
    ppPic.alt = `Photo de profil de ${displayName}`;
    ppName.textContent = displayName;
    ppUsername.textContent = `@${usernameDisplay}`;

    if (bio) {
        ppBio.textContent = bio;
        ppBio.classList.remove("is-empty");
    } else {
        ppBio.textContent = "Aucune bio pour l'instant.";
        ppBio.classList.add("is-empty");
    }

    let createdAt = null;
    if (userData.createdAt && userData.createdAt.toDate) {
        createdAt = userData.createdAt.toDate();
    }
    ppSince.textContent = createdAt ? formatSince(createdAt) : "";
    ppSince.closest(".pp-since").hidden = !createdAt;

    const canonicalUrl = `https://perspikative.com/@${usernameDisplay}`;
    updateMeta({
        title: `${displayName} — Perspikative | Artiste`,
        description: bio || `Découvre le profil de ${displayName} sur Perspikative.`,
        image: photo,
        url: canonicalUrl,
        indexable: true
    });

    showState(ppCard);
}

function renderPrivateProfile() {
    updateMeta({
        title: "Profil privé — Perspikative",
        description: "Ce profil est privé.",
        image: "https://perspikative.com/logo.svg",
        url: window.location.href,
        indexable: false
    });
    showState(ppPrivate);
}

// -----------------------------------------------------------------------
// Point d'entrée
// -----------------------------------------------------------------------
async function init() {
    const rawUsername = getUsernameFromUrl();

    if (!rawUsername) {
        goTo404();
        return;
    }

    const normalized = normalizeUsername(rawUsername);

    // Sécurité basique : mêmes règles de format qu'à l'écriture.
    // Un username mal formé ne peut de toute façon pas exister en base.
    if (!/^[a-z0-9_]{2,30}$/.test(normalized)) {
        goTo404();
        return;
    }

    try {
        const userData = await findUserByUsername(normalized);

        if (!userData) {
            goTo404();
            return;
        }

        if (userData.isPublic === true) {
            renderPublicProfile(userData);
        } else {
            renderPrivateProfile();
        }
    } catch (err) {
        console.error("Erreur lors du chargement du profil public :", err);
        goTo404();
    }
}

// On attend que firebase-init.js ait fini de s'initialiser. window.__prspkDb
// est exposé de façon asynchrone (import de modules + init Firebase), donc
// un setTimeout(0) ne suffit pas de façon fiable : selon la vitesse de
// chargement des modules, __prspkDb peut ne pas encore exister à ce
// moment-là (d'où le besoin de rafraîchir manuellement observé en prod).
// On poll donc jusqu'à ce qu'il soit disponible, avec un timeout de secours.
function waitForFirebase(callback, { intervalMs = 30, timeoutMs = 8000 } = {}) {
    if (window.__prspkDb) {
        callback();
        return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
        if (window.__prspkDb) {
            clearInterval(timer);
            callback();
        } else if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            console.error("Firebase n'a pas pu s'initialiser à temps.");
            goTo404();
        }
    }, intervalMs);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => waitForFirebase(init));
} else {
    waitForFirebase(init);
}