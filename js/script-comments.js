// ============================= SCRIPT-COMMENTS.JS =============================
// Gestion des commentaires Firebase dans la lightbox Perspikative
// ──────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Constantes ───────────────────────────────────────────────────────────
  var COMMENTS_PER_PAGE = 5;
  var PFP_COUNT         = 8;  // nb de photos de profil dans /pics/assets/pfp/

  // ── État local ───────────────────────────────────────────────────────────
  var currentDrawingId  = null;
  var allComments       = [];       // tous les commentaires chargés
  var displayedCount    = 0;        // combien sont actuellement affichés

  // ── Refs DOM ─────────────────────────────────────────────────────────────
  var listEl      = document.getElementById('lb-comments-list');
  var countEl     = document.getElementById('lb-comments-count');
  var moreBtn     = document.getElementById('lb-comments-more');
  var guestEl     = document.getElementById('lb-comment-guest');
  var inputWrap   = document.getElementById('lb-comment-input-wrap');
  var myPfpEl     = document.getElementById('lb-comment-my-pfp');
  var textarea    = document.getElementById('lb-comment-textarea');
  var sendBtn     = document.getElementById('lb-comment-send');

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
          ? '<button class="lb-comment-delete" aria-label="Supprimer" title="Supprimer">' +
              '<img src="/icons/lightbox-trash.svg" alt="" aria-hidden="true">' +
            '</button>'
          : '')
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

    // ── Vérification de la limite quotidienne avant l'envoi ──────────────
    checkAndIncrementLimit(user.uid).then(function (allowed) {
      if (!allowed) {
        // Limite atteinte : on informe l'utilisateur et on réactive le formulaire
        var limitMsg = document.getElementById('lb-comment-limit-msg');
        if (!limitMsg) {
          limitMsg = document.createElement('p');
          limitMsg.id        = 'lb-comment-limit-msg';
          limitMsg.className = 'lb-comment-error';
          limitMsg.textContent = 'Tu as atteint la limite de ' + DAILY_LIMIT + ' commentaires par jour. Reviens demain !';
          inputWrap.insertBefore(limitMsg, sendBtn);
        }
        sendBtn.disabled  = false;
        textarea.disabled = false;
        return;
      }

      // ── Limite OK : on envoie le commentaire ─────────────────────────
      // Supprime le message d'erreur s'il était affiché
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

    }).catch(function (err) {
      console.error('[Comments] Erreur vérification limite :', err);
      sendBtn.disabled  = false;
      textarea.disabled = false;
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
