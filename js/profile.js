/**
 * ═══════════════════════════════════════════════════════════════
 * profile.js — Perspikative
 * Gestion complète de la page profil universelle /@username
 * ═══════════════════════════════════════════════════════════════
 *
 * FLUX :
 *  1. Parse l'URL pour extraire le @username
 *  2. Cherche l'uid correspondant dans la collection "usernames"
 *  3. Charge le doc users/{uid} depuis Firestore
 *  4. Vérifie si le visiteur est le propriétaire (Firebase Auth)
 *  5. Affiche le profil (lecture) ou le mode édition (owner)
 *  6. Permet : modifier bio/nom/liens/visibilité, changer avatar/bannière, supprimer le compte
 *
 * COLLECTIONS FIRESTORE UTILISÉES :
 *  - usernames/{username}  → { uid }                     (index de recherche rapide)
 *  - users/{uid}           → { username, displayName, bio, isPublic, ... }
 */

import { auth, db, storage } from '/js/firebase-init.js';

import {
  onAuthStateChanged,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

/* ─────────────────────────────────────────────────────────────
   0. HELPERS GLOBAUX
───────────────────────────────────────────────────────────── */

/**
 * showToast — affiche une notification temporaire
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = type === 'success' ? `✓ ${message}` : `✕ ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * setState — affiche un état de page (loading / not-found / private / content)
 * @param {'loading'|'not-found'|'private'|'content'} state
 */
function setState(state) {
  document.getElementById('state-loading').style.display   = state === 'loading'   ? 'flex' : 'none';
  document.getElementById('state-not-found').style.display = state === 'not-found' ? 'flex' : 'none';
  document.getElementById('state-private').style.display   = state === 'private'   ? 'flex' : 'none';
  document.getElementById('profile-content').style.display = state === 'content'   ? 'block' : 'none';
}

/**
 * getPfpFromUid — avatar déterministe par uid (inchangé depuis account.js)
 * @param {string} uid
 * @returns {string} URL
 */
function getPfpFromUid(uid) {
  const AVATARS = [
    '/assets/pfp/1.webp',
    '/assets/pfp/2.webp',
    '/assets/pfp/3.webp',
    '/assets/pfp/4.webp',
    '/assets/pfp/5.webp',
    '/assets/pfp/6.webp',
    '/assets/pfp/7.webp',
    '/assets/pfp/8.webp',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return AVATARS[Math.abs(hash) % AVATARS.length];
}

/**
 * formatDate — formatte un Timestamp Firestore en date lisible
 * @param {import('firebase/firestore').Timestamp} ts
 */
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────
   1. PARSE L'URL POUR EXTRAIRE LE USERNAME
   perspikative.com/@tartineske  →  "tartineske"
───────────────────────────────────────────────────────────── */

function getUsernameFromURL() {
  // Gère les cas :
  //   /@tartineske          (path standard)
  //   /profile.html?u=tartineske  (fallback GitHub Pages sans réécriture)
  const pathname = window.location.pathname;
  const atMatch  = pathname.match(/\/@([a-zA-Z0-9_.-]+)/);
  if (atMatch) return atMatch[1].toLowerCase();

  const params = new URLSearchParams(window.location.search);
  const u = params.get('u');
  if (u) return u.toLowerCase();

  return null;
}

/* ─────────────────────────────────────────────────────────────
   2. CHARGEMENT DU PROFIL
───────────────────────────────────────────────────────────── */

let profileData = null;   // données Firestore du profil affiché
let profileUid  = null;   // uid du profil affiché
let currentUser = null;   // utilisateur connecté (ou null)

async function loadProfile(username) {
  setState('loading');

  // 2a. Résoudre le username → uid
  const usernameDoc = await getDoc(doc(db, 'usernames', username));
  if (!usernameDoc.exists()) {
    setState('not-found');
    return;
  }

  const uid = usernameDoc.data().uid;
  profileUid = uid;

  // 2b. Charger le profil
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) {
    setState('not-found');
    return;
  }

  profileData = { uid, ...userDoc.data() };

  // 2c. Vérifier la visibilité
  const isOwner = currentUser && currentUser.uid === uid;

  if (!profileData.isPublic && !isOwner) {
    setState('private');
    return;
  }

  // 2d. Injecter et afficher
  renderProfile(profileData, isOwner);
  setState('content');
}

/* ─────────────────────────────────────────────────────────────
   3. RENDU DU PROFIL
───────────────────────────────────────────────────────────── */

function renderProfile(data, isOwner) {
  // Titre de l'onglet
  document.title = `${data.displayName || data.username} — Perspikative`;

  // Avatar
  const avatarImg = document.getElementById('avatar-img');
  avatarImg.src = data.avatarUrl || getPfpFromUid(data.uid);
  avatarImg.alt = `Avatar de ${data.displayName || data.username}`;

  // Bannière
  if (data.bannerUrl) {
    const bannerImg = document.getElementById('banner-img');
    bannerImg.src    = data.bannerUrl;
    bannerImg.style.display = 'block';
  }

  // Nom + username
  document.getElementById('profile-displayname').textContent = data.displayName || data.username;
  document.getElementById('profile-username').textContent    = `@${data.username}`;

  // Badges
  const badgeEl = document.getElementById('profile-badges');
  badgeEl.innerHTML = '';

  const visiBadge = document.createElement('span');
  visiBadge.className = `badge ${data.isPublic ? 'badge-public' : 'badge-private'}`;
  visiBadge.textContent = data.isPublic ? '🌐 Public' : '🔒 Privé';
  badgeEl.appendChild(visiBadge);

  if (data.createdAt) {
    const joinBadge = document.createElement('span');
    joinBadge.className = 'badge badge-joined';
    joinBadge.textContent = `Membre depuis ${formatDate(data.createdAt)}`;
    badgeEl.appendChild(joinBadge);
  }

  // Bio
  const bioEl = document.getElementById('profile-bio');
  if (data.bio && data.bio.trim()) {
    bioEl.textContent = data.bio;
    bioEl.classList.remove('profile-bio-placeholder');
  } else if (isOwner) {
    bioEl.textContent = 'Ajoute une bio pour te présenter…';
    bioEl.classList.add('profile-bio-placeholder');
  }

  // Liens sociaux
  renderSocials(data.socialLinks || {});

  // Navbar : bouton connexion ou "Mon profil"
  updateNavAuth(isOwner, data.username);

  // Si propriétaire → activer les contrôles d'édition
  if (isOwner) {
    document.body.classList.add('is-owner');
    populateSettingsFields(data);
  }
}

function renderSocials(links) {
  const container = document.getElementById('profile-socials');
  container.innerHTML = '';

  const defs = [
    { key: 'instagram', label: 'Instagram', prefix: 'https://instagram.com/', icon: '/icons/instagram.svg' },
    { key: 'twitter',   label: 'Twitter',   prefix: 'https://x.com/',         icon: '𝕏' },
    { key: 'website',   label: 'Site web',  prefix: '',                        icon: '🔗' },
  ];

  defs.forEach(({ key, label, prefix, icon }) => {
    const val = links[key];
    if (!val) return;

    const cleanHandle = val.replace(/^@/, '');
    const href = prefix + cleanHandle;

    const a = document.createElement('a');
    a.className = 'social-link';
    a.href      = href;
    a.target    = '_blank';
    a.rel       = 'noopener noreferrer';
    a.textContent = `${icon} ${label}`;
    container.appendChild(a);
  });
}

function updateNavAuth(isOwner, username) {
  const btn = document.getElementById('nav-auth-btn');
  if (isOwner) {
    btn.textContent = 'Mon profil';
    btn.href = `/@${username}`;
  } else if (currentUser) {
    btn.textContent = 'Mon profil';
    btn.href = `/@${currentUser.displayName || ''}`;
  }
}

/* ─────────────────────────────────────────────────────────────
   4. POPULE LES CHAMPS DU PANNEAU SETTINGS
───────────────────────────────────────────────────────────── */

function populateSettingsFields(data) {
  document.getElementById('field-displayname').value  = data.displayName  || '';
  document.getElementById('field-bio').value          = data.bio          || '';
  document.getElementById('field-instagram').value    = data.socialLinks?.instagram || '';
  document.getElementById('field-twitter').value      = data.socialLinks?.twitter   || '';
  document.getElementById('field-website').value      = data.socialLinks?.website   || '';
  document.getElementById('toggle-public').checked    = data.isPublic !== false; // défaut: public
}

/* ─────────────────────────────────────────────────────────────
   5. MODE ÉDITION
───────────────────────────────────────────────────────────── */

document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
  document.body.classList.add('edit-mode');
  // Focus sur le champ displayname dans le panneau settings
  document.getElementById('field-displayname').focus();
});

document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
  await saveProfile();
});

async function saveProfile() {
  if (!profileUid || !currentUser || currentUser.uid !== profileUid) return;

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  try {
    const newDisplayName = document.getElementById('field-displayname').value.trim();
    const newBio         = document.getElementById('field-bio').value.trim();
    const newInstagram   = document.getElementById('field-instagram').value.trim();
    const newTwitter     = document.getElementById('field-twitter').value.trim();
    const newWebsite     = document.getElementById('field-website').value.trim();
    const isPublic       = document.getElementById('toggle-public').checked;

    if (!newDisplayName) {
      showToast('Le nom d\'affichage ne peut pas être vide.', 'error');
      return;
    }

    const updatePayload = {
      displayName: newDisplayName,
      bio:         newBio,
      isPublic:    isPublic,
      socialLinks: {
        instagram: newInstagram,
        twitter:   newTwitter,
        website:   newWebsite,
      },
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'users', profileUid), updatePayload);

    // Mettre à jour l'affichage
    document.getElementById('profile-displayname').textContent = newDisplayName;
    document.getElementById('profile-bio').textContent         = newBio || '';
    renderSocials(updatePayload.socialLinks);

    // Badge visibilité
    const badgeEl = document.getElementById('profile-badges');
    const visiBadge = badgeEl.querySelector('.badge-public, .badge-private');
    if (visiBadge) {
      visiBadge.className   = `badge ${isPublic ? 'badge-public' : 'badge-private'}`;
      visiBadge.textContent = isPublic ? '🌐 Public' : '🔒 Privé';
    }

    // Mettre à jour les données locales
    profileData = { ...profileData, ...updatePayload };

    document.body.classList.remove('edit-mode');
    showToast('Profil mis à jour !');

  } catch (err) {
    console.error('[profile] Erreur save:', err);
    showToast('Erreur lors de la sauvegarde.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      Enregistrer`;
  }
}

/* ─────────────────────────────────────────────────────────────
   6. UPLOAD AVATAR
───────────────────────────────────────────────────────────── */

document.getElementById('btn-edit-avatar')?.addEventListener('click', () => {
  document.getElementById('input-avatar').click();
});

document.getElementById('input-avatar')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !profileUid) return;

  // Vérification taille (2 Mo max)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image trop lourde (2 Mo max).', 'error');
    return;
  }

  try {
    showToast('Upload en cours…');
    const storageRef = ref(storage, `avatars/${profileUid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, 'users', profileUid), { avatarUrl: url, updatedAt: serverTimestamp() });

    document.getElementById('avatar-img').src = url;
    showToast('Avatar mis à jour !');
  } catch (err) {
    console.error('[profile] Erreur avatar upload:', err);
    showToast('Erreur lors de l\'upload.', 'error');
  }
});

/* ─────────────────────────────────────────────────────────────
   7. UPLOAD BANNIÈRE
───────────────────────────────────────────────────────────── */

document.getElementById('btn-edit-banner')?.addEventListener('click', () => {
  document.getElementById('input-banner').click();
});

document.getElementById('input-banner')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !profileUid) return;

  if (file.size > 4 * 1024 * 1024) {
    showToast('Image trop lourde (4 Mo max).', 'error');
    return;
  }

  try {
    showToast('Upload de la bannière…');
    const storageRef = ref(storage, `banners/${profileUid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, 'users', profileUid), { bannerUrl: url, updatedAt: serverTimestamp() });

    const bannerImg = document.getElementById('banner-img');
    bannerImg.src          = url;
    bannerImg.style.display = 'block';

    showToast('Bannière mise à jour !');
  } catch (err) {
    console.error('[profile] Erreur bannière upload:', err);
    showToast('Erreur lors de l\'upload.', 'error');
  }
});

/* ─────────────────────────────────────────────────────────────
   8. SUPPRESSION DU COMPTE
───────────────────────────────────────────────────────────── */

const modalDelete      = document.getElementById('modal-delete');
const btnDeleteAccount = document.getElementById('btn-delete-account');
const btnModalCancel   = document.getElementById('btn-modal-cancel');
const btnModalConfirm  = document.getElementById('btn-modal-confirm-delete');

btnDeleteAccount?.addEventListener('click', () => {
  modalDelete.classList.add('open');
});

btnModalCancel?.addEventListener('click', () => {
  modalDelete.classList.remove('open');
});

// Fermer en cliquant sur l'overlay
modalDelete?.addEventListener('click', (e) => {
  if (e.target === modalDelete) modalDelete.classList.remove('open');
});

btnModalConfirm?.addEventListener('click', async () => {
  if (!currentUser || !profileUid || currentUser.uid !== profileUid) return;

  btnModalConfirm.disabled     = true;
  btnModalConfirm.textContent  = 'Suppression…';

  try {
    // 1. Supprimer les données Firestore
    await deleteDoc(doc(db, 'users', profileUid));
    await deleteDoc(doc(db, 'usernames', profileData.username));

    // 2. Supprimer l'utilisateur Firebase Auth
    //    Note : si l'utilisateur ne s'est pas connecté récemment,
    //    Firebase peut lancer une erreur "requires-recent-login".
    //    Dans ce cas, redirige vers login.html avec un flag.
    await deleteUser(currentUser);

    // 3. Rediriger vers l'accueil
    showToast('Compte supprimé. À bientôt! 👋');
    setTimeout(() => { window.location.href = '/'; }, 1500);

  } catch (err) {
    console.error('[profile] Erreur suppression compte:', err);

    if (err.code === 'auth/requires-recent-login') {
      showToast('Reconnecte-toi pour supprimer ton compte.', 'error');
      setTimeout(() => { window.location.href = '/login.html?action=delete'; }, 2000);
    } else {
      showToast('Erreur lors de la suppression.', 'error');
    }

    btnModalConfirm.disabled    = false;
    btnModalConfirm.textContent = 'Supprimer';
  }
});

/* ─────────────────────────────────────────────────────────────
   9. POINT D'ENTRÉE PRINCIPAL
   Attend que Firebase Auth soit prêt, puis charge le profil
───────────────────────────────────────────────────────────── */

const username = getUsernameFromURL();

if (!username) {
  // Pas de username dans l'URL → rediriger vers l'accueil
  window.location.href = '/';
} else {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    // Met à jour le bouton navbar si connecté
    if (user) {
      const navBtn = document.getElementById('nav-auth-btn');
      navBtn.textContent = 'Mon compte';
      navBtn.href        = `/profile`;
    }

    await loadProfile(username);
  });
}