// ============================= SCRIPT-COMMENTS.JS =============================
// Gestion des commentaires Firebase dans la lightbox Perspikative
// ──────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Constantes ───────────────────────────────────────────────────────────
  var COMMENTS_PER_PAGE = 5;
  var PFP_COUNT         = 8;  // nb de photos de profil dans /pics/assets/pfp/

  // Catégories de signalement : chaque catégorie a un id, un label, et des
  // sous-catégories (id + label). Modifie cette liste si tu veux ajouter/
  // retirer des raisons de signalement, tout le reste s'adapte tout seul.
  var REPORT_CATEGORIES = [
    {
      id: 'harcelement',
      label: 'Harcèlement',
      subcategories: [
        { id: 'insultes', label: 'Insultes' },
        { id: 'menaces', label: 'Menaces' },
        { id: 'moqueries', label: 'Moqueries répétées' }
      ]
    },
    {
      id: 'contenu-explicite',
      label: 'Contenu explicite',
      subcategories: [
        { id: 'pornographie', label: 'Contenu pornographique' },
        { id: 'violence', label: 'Violence graphique' }
      ]
    },
    {
      id: 'spam',
      label: 'Spam / Publicité',
      subcategories: [
        { id: 'lien-suspect', label: 'Lien suspect' },
        { id: 'contenu-commercial', label: 'Contenu commercial' }
      ]
    },
    {
      id: 'autre',
      label: 'Autre',
      subcategories: [
        { id: 'hors-sujet', label: 'Hors-sujet' },
        { id: 'autre-raison', label: 'Autre raison' }
      ]
    }
  ];

  // ── État local ───────────────────────────────────────────────────────────
  var currentDrawingId  = null;
  var allComments       = [];       // tous les commentaires chargés
  var displayedCount    = 0;        // combien sont actuellement affichés
  var reportTargetId    = null;     // id du commentaire en cours de signalement
  var reportTargetAuthorUid = null; // uid de l'auteur du commentaire signalé
  var reportTargetText  = null;     // texte du commentaire signalé (snapshot)
  var reportedThisSession = {};     // cache local { commentId: true } pour ne pas re-checker Firestore sans arrêt

  // ── Refs DOM ─────────────────────────────────────────────────────────────
  var listEl      = document.getElementById('lb-comments-list');
  var countEl     = document.getElementById('lb-comments-count');
  var moreBtn     = document.getElementById('lb-comments-more');
  var guestEl     = document.getElementById('lb-comment-guest');
  var inputWrap   = document.getElementById('lb-comment-input-wrap');
  var myPfpEl     = document.getElementById('lb-comment-my-pfp');
  var textarea    = document.getElementById('lb-comment-textarea');
  var sendBtn     = document.getElementById('lb-comment-send');

  // Refs du panneau de signalement (voir markup ajouté dans creations.html)
  var reportOverlay   = document.getElementById('report-overlay');
  var reportListEl    = document.getElementById('report-category-list');
  var reportCloseBtn  = document.getElementById('report-close');
  var reportConfirmEl = document.getElementById('report-confirm');

  if (!listEl) return; // la lightbox commentaires n'est pas sur cette page

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITAIRES
  // ══════════════════════════════════════════════════════════════════════════

  function formatRelativeTime(ts) {
    if (!ts) return '';
    var now   = Date.now();
    var date  = ts.toDate ? ts.toDate() : new Date(ts);
    var diff  = Math.floor((now - date.getTime()) / 1000); // secondes

    if (diff < 60)          return 'à l\'instant';
    if (diff < 3600)        return Math.floor(diff / 60) + ' min';
    if (diff < 86400)       return Math.floor(diff / 3600) + ' h';
    if (diff < 2592000)     return Math.floor(diff / 86400) + ' j';
    if (diff < 31536000)    return Math.floor(diff / 2592000) + ' mois';
    return Math.floor(diff / 31536000) + ' an' + (Math.floor(diff / 31536000) > 1 ? 's' : '');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showSpinner() {
    listEl.innerHTML = '<div class="lb-comments-loading"><span class="lb-spinner"></span></div>';
    countEl.textContent = '';
    if (moreBtn) moreBtn.style.display = 'none';
  }

  function updateCountLabel(total) {
    if (!countEl) return;
    countEl.textContent = total > 0 ? '(' + total + ')' : '';
  }

  // ── Détermine si le commentaire appartient à l'utilisateur connecté ──────
  function isOwn(comment) {
    var user = window.__prspkUser;
    return user && comment.uid && comment.uid === user.uid;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  function buildCommentEl(comment) {
    var item = document.createElement('div');
    item.className    = 'lb-comment-item';
    item.dataset.id   = comment.id;

    var pfpSrc = comment.pfp || '/pics/assets/pfp/1.webp';

    item.innerHTML =
      '<img class="lb-comment-pfp" src="' + escapeHtml(pfpSrc) + '" alt="avatar">' +
      '<div class="lb-comment-body">' +
        '<div class="lb-comment-meta">' +
          '<span class="lb-comment-pseudo">' + escapeHtml(comment.pseudo || 'Anonyme') + '</span>' +
          '<span class="lb-comment-time">' + formatRelativeTime(comment.createdAt) + '</span>' +
        '</div>' +
        '<div class="lb-comment-text">' + escapeHtml(comment.text) + '</div>' +
        (isOwn(comment)
          ? ''
          : '<button class="lb-comment-report" aria-label="Signaler" title="Signaler">' +
              '<img src="/icons/lightbox-report.svg" alt="" aria-hidden="true">' +
            '</button>') +
        (isOwn(comment)
          ? '<button class="lb-comment-delete" aria-label="Supprimer" title="Supprimer">' +
              '<img src="/icons/lightbox-trash.svg" alt="" aria-hidden="true">' +
            '</button>'
          : '') +
      '</div>';

    // Listener suppression
    if (isOwn(comment)) {
      var delBtn = item.querySelector('.lb-comment-delete');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          deleteComment(comment.id, item);
        });
      }
    }

    // Listener signalement (dispo pour tout le monde SAUF l'auteur du commentaire)
    var reportBtn = item.querySelector('.lb-comment-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', function () {
        openReportPanel(comment);
      });
    }

    return item;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AFFICHAGE DE LA LISTE
  // ══════════════════════════════════════════════════════════════════════════

  function renderComments() {
    listEl.innerHTML = '';

    if (allComments.length === 0) {
      listEl.innerHTML = '<p class="lb-comments-empty">Sois le premier à réagir !</p>';
      if (moreBtn) moreBtn.style.display = 'none';
      updateCountLabel(0);
      return;
    }

    updateCountLabel(allComments.length);

    // On affiche les `displayedCount` premiers (les plus récents sont en tête)
    var toShow = allComments.slice(0, displayedCount);
    toShow.forEach(function (c) {
      listEl.appendChild(buildCommentEl(c));
    });

    // Bouton "Afficher plus"
    if (moreBtn) {
      moreBtn.style.display = displayedCount < allComments.length ? 'block' : 'none';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CHARGEMENT DEPUIS FIREBASE
  // ══════════════════════════════════════════════════════════════════════════

  function loadComments(drawingId) {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    if (!db || !fire) return;

    showSpinner();
    allComments    = [];
    displayedCount = COMMENTS_PER_PAGE;

    var colRef = fire.collection(db, 'drawings', drawingId, 'comments');
    var q      = fire.query(colRef, fire.orderBy('createdAt', 'desc'));

    fire.getDocs(q).then(function (snap) {
      snap.forEach(function (docSnap) {
        allComments.push(Object.assign({ id: docSnap.id }, docSnap.data()));
      });
      renderComments();
    }).catch(function (err) {
      console.error('[Comments] Erreur chargement :', err);
      listEl.innerHTML = '<p class="lb-comments-empty">Impossible de charger les commentaires</p>';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENVOI D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  function sendComment() {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    var user = window.__prspkUser;
    if (!db || !fire || !user || !currentDrawingId) return;

    var text = textarea.value.trim();
    if (!text) return;

    sendBtn.disabled  = true;
    textarea.disabled = true;

    // Supprime le message d'erreur s'il était affiché (ancien système de limite)
    var limitMsg = document.getElementById('lb-comment-limit-msg');
    if (limitMsg) limitMsg.remove();

    var colRef = fire.collection(db, 'drawings', currentDrawingId, 'comments');
    fire.addDoc(colRef, {
      uid:       user.uid,
      email:     user.email || null,   // stocké pour modération uniquement, jamais affiché
      pseudo:    user.displayName || 'Anonyme',
      pfp:       user.photoURL || getPfpFromUid(user.uid),
      text:      text,
      createdAt: fire.serverTimestamp()
    }).then(function (docRef) {
      textarea.value = '';
      autoResizeTextarea();

      // Ajoute le commentaire localement en tête de liste
      var newComment = {
        id:        docRef.id,
        uid:       user.uid,
        pseudo:    user.displayName || 'Anonyme',
        pfp:       user.photoURL || getPfpFromUid(user.uid),
        text:      text,
        createdAt: { toDate: function () { return new Date(); } }
      };
      allComments.unshift(newComment);
      if (displayedCount < allComments.length) displayedCount++;
      renderComments();

      // Scroll vers le haut de la liste
      listEl.scrollTop = 0;
    }).catch(function (err) {
      console.error('[Comments] Erreur envoi :', err);
    }).finally(function () {
      sendBtn.disabled  = false;
      textarea.disabled = false;
      textarea.focus();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUPPRESSION D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  function deleteComment(commentId, itemEl) {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    if (!db || !fire || !currentDrawingId) return;

    // Animation de sortie
    itemEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    itemEl.style.opacity    = '0';
    itemEl.style.transform  = 'translateX(-8px)';

    var docRef = fire.doc(db, 'drawings', currentDrawingId, 'comments', commentId);
    fire.deleteDoc(docRef).then(function () {
      allComments = allComments.filter(function (c) { return c.id !== commentId; });
      displayedCount = Math.max(COMMENTS_PER_PAGE, Math.min(displayedCount, allComments.length));
      renderComments();
    }).catch(function (err) {
      console.error('[Comments] Erreur suppression :', err);
      itemEl.style.opacity   = '1';
      itemEl.style.transform = 'none';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SIGNALEMENT D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  // ── Identifiant anonyme (pour les visiteurs non connectés) ──────────────
  // Stocké en localStorage, généré une seule fois par navigateur. Sert à
  // fabriquer un ID de document stable pour empêcher le double signalement
  // depuis le même appareil/navigateur (ce n'est pas infaillible : ça saute
  // si la personne vide son cache ou change de navigateur, mais c'est le
  // seul repère possible sans compte).
  var ANON_ID_KEY = 'prspk_anon_id';

  function getAnonId() {
    try {
      var id = localStorage.getItem(ANON_ID_KEY);
      if (!id) {
        id = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(ANON_ID_KEY, id);
      }
      return id;
    } catch (e) {
      // localStorage indisponible (navigation privée stricte, etc.) :
      // on retombe sur un id de session (pas persistant, mais ça n'empêche
      // pas Firestore de fonctionner, juste la persistance du "déjà signalé")
      return 'anon_session_fallback';
    }
  }

  // ── Petit cache local des signalements déjà faits par CE navigateur ─────
  // (uniquement pour les non-connectés, pour éviter même de rouvrir la
  // lightbox inutilement — Firestore reste la source de vérité finale)
  var REPORTED_LOCAL_KEY = 'prspk_reported_comments';

  function getLocallyReportedIds() {
    try {
      var raw = localStorage.getItem(REPORTED_LOCAL_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function markLocallyReported(commentId) {
    try {
      var map = getLocallyReportedIds();
      map[commentId] = true;
      localStorage.setItem(REPORTED_LOCAL_KEY, JSON.stringify(map));
    } catch (e) {
      // silencieux : au pire, pas de mémoire locale, Firestore protège quand même
    }
  }

  // ── ID de document déterministe pour le signalement ──────────────────────
  // Connecté  → l'UID de l'utilisateur (1 signalement par personne et par
  //             commentaire, garanti par Firestore)
  // Non connecté → l'ID anonyme du navigateur
  function getReportDocId() {
    var user = window.__prspkUser;
    return user ? user.uid : getAnonId();
  }

  // Vérifie si CE commentaire a déjà été signalé par CETTE personne
  // (regarde d'abord le cache local rapide, sinon interroge Firestore)
  function hasAlreadyReported(commentId) {
    if (reportedThisSession[commentId]) return Promise.resolve(true);

    var user = window.__prspkUser;
    if (!user) {
      // Non connecté : le localStorage fait foi côté client
      var localMap = getLocallyReportedIds();
      return Promise.resolve(!!localMap[commentId]);
    }

    // Connecté : on vérifie réellement sur Firestore (fiable, multi-appareil)
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    if (!db || !fire || !currentDrawingId) return Promise.resolve(false);

    var docRef = fire.doc(
      db, 'drawings', currentDrawingId, 'comments', commentId, 'reports', getReportDocId()
    );
    return fire.getDoc(docRef).then(function (snap) {
      return snap.exists();
    }).catch(function () {
      return false;
    });
  }

  // Construit dynamiquement les catégories + sous-catégories dans le panneau
  function buildReportCategories() {
    if (!reportListEl) return;
    reportListEl.innerHTML = '';

    REPORT_CATEGORIES.forEach(function (cat) {
      var block = document.createElement('div');
      block.className = 'report-category-block';

      var title = document.createElement('p');
      title.className = 'report-category-title';
      title.textContent = cat.label;
      block.appendChild(title);

      var subWrap = document.createElement('div');
      subWrap.className = 'report-subcategory-row';

      cat.subcategories.forEach(function (sub) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'report-subcategory-btn';
        btn.textContent = sub.label;
        btn.dataset.category    = cat.id;
        btn.dataset.subcategory = sub.id;
        btn.addEventListener('click', function () {
          submitReport(cat.id, sub.id);
        });
        subWrap.appendChild(btn);
      });

      block.appendChild(subWrap);
      reportListEl.appendChild(block);
    });
  }

  function openReportPanel(comment) {
    if (!reportOverlay) return;

    reportTargetId         = comment.id;
    reportTargetAuthorUid  = comment.uid || null;
    reportTargetText       = comment.text || '';

    // Reset de l'état visuel (au cas où un précédent signalement était affiché)
    reportOverlay.classList.remove('report-submitted', 'report-already-done');
    if (reportConfirmEl) reportConfirmEl.textContent = '';

    reportOverlay.classList.add('active');

    // On vérifie si cette personne a déjà signalé ce commentaire avant
    // d'afficher les catégories. Pendant la vérification, on affiche un
    // court message d'attente pour éviter tout clic sur un choix pas encore
    // validé comme disponible.
    if (reportConfirmEl) reportConfirmEl.textContent = 'Vérification…';
    if (reportListEl) reportListEl.style.opacity = '0.35';

    hasAlreadyReported(comment.id).then(function (already) {
      // Le panneau a pu être fermé entre-temps, ou un autre commentaire ouvert
      if (reportTargetId !== comment.id) return;

      if (reportListEl) reportListEl.style.opacity = '';

      if (already) {
        reportOverlay.classList.add('report-already-done');
        if (reportConfirmEl) {
          reportConfirmEl.textContent = 'Tu as déjà signalé ce commentaire.';
        }
      } else {
        if (reportConfirmEl) reportConfirmEl.textContent = '';
      }
    });
  }

  function closeReportPanel() {
    if (!reportOverlay) return;
    reportOverlay.classList.remove('active', 'report-submitted', 'report-already-done');
    reportTargetId        = null;
    reportTargetAuthorUid = null;
    reportTargetText      = null;
  }

  function submitReport(categoryId, subcategoryId) {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    if (!db || !fire || !currentDrawingId || !reportTargetId) return;

    // Sécurité supplémentaire : si le panneau affiche déjà "déjà signalé",
    // on bloque l'envoi même si le clic passe entre les mailles du filet
    if (reportOverlay.classList.contains('report-already-done')) return;

    var user        = window.__prspkUser;
    var targetId    = reportTargetId;
    var reportDocId = getReportDocId();

    // ID de document déterministe : Firestore refusera la création si un
    // document avec ce même ID existe déjà pour ce commentaire (voir règles
    // Firestore : allow create nécessite que le document n'existe pas encore)
    var docRef = fire.doc(
      db, 'drawings', currentDrawingId, 'comments', targetId, 'reports', reportDocId
    );

    fire.setDoc(docRef, {
      reporterUid:      user ? user.uid : null,
      category:         categoryId,
      subcategory:       subcategoryId,
      commentAuthorUid: reportTargetAuthorUid,
      commentText:      reportTargetText,
      createdAt:        fire.serverTimestamp()
    }).then(function () {
      // Mémorisation locale pour ne plus jamais re-proposer ce commentaire
      reportedThisSession[targetId] = true;
      if (!user) markLocallyReported(targetId);

      // Petit message de confirmation, puis fermeture auto du panneau
      reportOverlay.classList.add('report-submitted');
      if (reportConfirmEl) {
        reportConfirmEl.textContent = 'Merci, ce commentaire a été signalé.';
      }
      setTimeout(function () {
        closeReportPanel();
      }, 1400);
    }).catch(function (err) {
      console.error('[Report] Erreur envoi signalement :', err);
      // Si Firestore a refusé parce que le document existe déjà (double clic
      // rapide, ou signalement fait entre-temps depuis un autre onglet), on
      // l'indique clairement plutôt que d'afficher une erreur générique
      reportedThisSession[targetId] = true;
      if (!user) markLocallyReported(targetId);
      if (reportConfirmEl) {
        reportConfirmEl.textContent = 'Tu as déjà signalé ce commentaire.';
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHOTO DE PROFIL PAR DÉFAUT (déterministe selon uid)
  // ══════════════════════════════════════════════════════════════════════════

  function getPfpFromUid(uid) {
    var hash = 0;
    for (var i = 0; i < uid.length; i++) {
      hash = (hash * 31 + uid.charCodeAt(i)) & 0xffffffff;
    }
    var num = (Math.abs(hash) % PFP_COUNT) + 1;
    return '/pics/assets/pfp/' + num + '.webp';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ÉTAT DU FORMULAIRE (connecté / déconnecté)
  // ══════════════════════════════════════════════════════════════════════════

  function updateFormState(user) {
    if (!guestEl || !inputWrap) return;
    if (user) {
      guestEl.style.display   = 'none';
      inputWrap.style.display = 'flex';

      // Photo de profil de l'utilisateur connecté
      if (myPfpEl) {
        myPfpEl.src = user.photoURL || getPfpFromUid(user.uid);
      }
    } else {
      guestEl.style.display   = 'flex';
      inputWrap.style.display = 'none';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-RESIZE TEXTAREA
  // ══════════════════════════════════════════════════════════════════════════

  function autoResizeTextarea() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTENERS
  // ══════════════════════════════════════════════════════════════════════════

  // Chargement à l'ouverture de la lightbox
  document.addEventListener('prspk:lightbox-opened', function (e) {
    currentDrawingId = e.detail.drawingId;
    loadComments(currentDrawingId);
  });

  // Auth state
  document.addEventListener('prspk:auth-ready', function (e) {
    updateFormState(e.detail.user);
  });

  // Bouton "Afficher plus"
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      displayedCount = Math.min(displayedCount + COMMENTS_PER_PAGE, allComments.length);
      renderComments();
    });
  }

  // Envoi
  if (sendBtn) {
    sendBtn.addEventListener('click', sendComment);
  }

  if (textarea) {
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendComment();
      }
    });
    textarea.addEventListener('input', autoResizeTextarea);
  }

  // Panneau de signalement : fermeture (croix + clic sur le fond)
  if (reportCloseBtn) {
    reportCloseBtn.addEventListener('click', closeReportPanel);
  }
  if (reportOverlay) {
    reportOverlay.addEventListener('click', function (e) {
      if (e.target === reportOverlay) closeReportPanel();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && reportOverlay && reportOverlay.classList.contains('active')) {
      closeReportPanel();
    }
  });

  // Construction initiale des catégories de signalement
  buildReportCategories();

  // Synchronisation si auth change après le chargement de la page
  document.addEventListener('prspk:auth-ready', function (e) {
    updateFormState(e.detail.user);
    // Re-render pour mettre à jour les boutons supprimer
    if (allComments.length > 0) renderComments();
  });

  // Init immédiat si Firebase déjà prêt (module chargé avant ce script)
  if (typeof window.__prspkUser !== 'undefined') {
    updateFormState(window.__prspkUser);
  }

})();

// ============================= FIN SCRIPT-COMMENTS.JS =============================
