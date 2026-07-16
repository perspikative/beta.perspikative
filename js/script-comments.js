// ============================= SCRIPT-COMMENTS.JS =============================
// Gestion des commentaires Firebase dans la lightbox Perspikative
// + Système de restrictions : limite quotidienne, longueur max, anti-spam,
//   liens interdits, mots interdits, nettoyage, signalements, compteur de
//   signalements, masquage automatique.
// ──────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Constantes ───────────────────────────────────────────────────────────
  var COMMENTS_PER_PAGE = 5;
  var PFP_COUNT         = 8;  // nb de photos de profil dans /pics/assets/pfp/
  var HIDE_AT_REPORTS   = 5;  // reportCount à partir duquel le commentaire est masqué

  var REPORT_REASONS = [
    { value: 'spam',          label: 'Spam' },
    { value: 'harassment',    label: 'Harcèlement' },
    { value: 'hate_speech',   label: 'Discours haineux' },
    { value: 'violence',      label: 'Violence' },
    { value: 'nudity',        label: 'Nudité' },
    { value: 'misinformation',label: 'Désinformation' },
    { value: 'other',         label: 'Autre' }
  ];

  // ── État local ───────────────────────────────────────────────────────────
  var currentDrawingId  = null;
  var allComments       = [];       // tous les commentaires chargés
  var displayedCount    = 0;        // combien sont actuellement affichés
  var reportedByMe      = {};       // cache local { commentId: true } pour éviter double-signalement dans la session

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

  // ── Affiche un message d'erreur temporaire au-dessus de la zone de saisie ─
  function showFormError(message) {
    var errEl = document.getElementById('lb-comment-error-msg');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.id = 'lb-comment-error-msg';
      errEl.className = 'lb-comment-error';
      inputWrap.insertBefore(errEl, inputWrap.firstChild);
    }
    errEl.textContent = message;
    errEl.style.display = 'block';

    // Auto-masquage après quelques secondes pour ne pas polluer l'UI
    clearTimeout(showFormError._timer);
    showFormError._timer = setTimeout(function () {
      if (errEl) errEl.style.display = 'none';
    }, 5000);
  }

  function clearFormError() {
    var errEl = document.getElementById('lb-comment-error-msg');
    if (errEl) errEl.style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDU D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  function buildCommentEl(comment) {
    var item = document.createElement('div');
    item.className    = 'lb-comment-item';
    item.dataset.id   = comment.id;

    var pfpSrc = comment.pfp || '/pics/assets/pfp/1.webp';

    // ── Commentaire masqué (reportCount >= seuil) ─────────────────────────
    // On n'affiche jamais le contenu d'un commentaire masqué (sauf pour son
    // propre auteur, pour qu'il comprenne ce qu'il a écrit), on garde le
    // document en base mais on remplace visuellement le texte.
    var isHiddenForModeration = comment.hidden === true;
    var showRealContent = !isHiddenForModeration || isOwn(comment);

    var bodyText = showRealContent
      ? escapeHtml(comment.text)
      : '<em>Ce commentaire est masqué en attente de modération.</em>';

    var alreadyReported = reportedByMe[comment.id] ||
      (comment.reportedBy && window.__prspkUser && comment.reportedBy.indexOf(window.__prspkUser.uid) !== -1);

    item.innerHTML =
      '<img class="lb-comment-pfp" src="' + escapeHtml(pfpSrc) + '" alt="avatar">' +
      '<div class="lb-comment-body' + (isHiddenForModeration ? ' lb-comment-hidden' : '') + '">' +
        '<div class="lb-comment-meta">' +
          '<span class="lb-comment-pseudo">' + escapeHtml(comment.pseudo || 'Anonyme') + '</span>' +
          '<span class="lb-comment-time">' + formatRelativeTime(comment.createdAt) + '</span>' +
        '</div>' +
        '<div class="lb-comment-text">' + bodyText + '</div>' +
        '<div class="lb-comment-actions-row">' +
          (isOwn(comment)
            ? '<button class="lb-comment-delete" aria-label="Supprimer" title="Supprimer">' +
                '<img src="/icons/lightbox-trash.svg" alt="" aria-hidden="true">' +
              '</button>'
            : '') +
          (!isOwn(comment) && window.__prspkUser
            ? '<button class="lb-comment-report' + (alreadyReported ? ' is-reported' : '') + '" ' +
                (alreadyReported ? 'disabled' : '') +
                ' aria-label="Signaler" title="Signaler">' +
                (alreadyReported ? 'Signalé' : 'Signaler') +
              '</button>'
            : '') +
        '</div>' +
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

    // Listener signalement
    if (!isOwn(comment) && window.__prspkUser) {
      var reportBtn = item.querySelector('.lb-comment-report');
      if (reportBtn && !alreadyReported) {
        reportBtn.addEventListener('click', function () {
          openReportDialog(comment, reportBtn);
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
      listEl.innerHTML = '<p class="lb-comments-empty">Impossible de charger les commentaires.</p>';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENVOI D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════

  function sendComment() {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    var user = window.__prspkUser;
    var mod  = window.__prspkModeration;
    var rl   = window.__prspkRateLimit;
    if (!db || !fire || !user || !currentDrawingId || !mod || !rl) return;

    clearFormError();

    var rawText = textarea.value;

    // ── 1. Validation locale (longueur, mots interdits, liens, spam) ──────
    var validation = mod.validateComment(rawText);
    if (!validation.ok) {
      showFormError(validation.error);
      return;
    }
    var cleanedText = validation.cleaned;

    sendBtn.disabled  = true;
    textarea.disabled = true;

    // ── 2. Vérification de la limite quotidienne ──────────────────────────
    rl.canSendComment(user.uid).then(function (check) {
      if (!check.allowed) {
        showFormError('Vous avez atteint la limite quotidienne de commentaires. Revenez demain.');
        sendBtn.disabled  = false;
        textarea.disabled = false;
        return;
      }

      // ── 3. Envoi effectif du commentaire ─────────────────────────────
      var colRef = fire.collection(db, 'drawings', currentDrawingId, 'comments');
      fire.addDoc(colRef, {
        uid:          user.uid,
        email:        user.email || null,   // stocké pour modération uniquement, jamais affiché
        pseudo:       user.displayName || 'Anonyme',
        pfp:          user.photoURL || getPfpFromUid(user.uid),
        text:         cleanedText,
        createdAt:    fire.serverTimestamp(),
        reportCount:  0,
        reportedBy:   [],
        hidden:       false
      }).then(function (docRef) {
        textarea.value = '';
        autoResizeTextarea();

        // Incrémente le compteur quotidien SEULEMENT après succès de l'écriture
        rl.registerCommentSent(user.uid).catch(function (err) {
          console.error('[Comments] Erreur maj limite quotidienne :', err);
        });

        // Ajoute le commentaire localement en tête de liste
        var newComment = {
          id:          docRef.id,
          uid:         user.uid,
          pseudo:      user.displayName || 'Anonyme',
          pfp:         user.photoURL || getPfpFromUid(user.uid),
          text:        cleanedText,
          reportCount: 0,
          reportedBy:  [],
          hidden:      false,
          createdAt:   { toDate: function () { return new Date(); } }
        };
        allComments.unshift(newComment);
        if (displayedCount < allComments.length) displayedCount++;
        renderComments();

        // Scroll vers le haut de la liste
        listEl.scrollTop = 0;
      }).catch(function (err) {
        console.error('[Comments] Erreur envoi :', err);
        showFormError('Une erreur réseau est survenue. Merci de réessayer.');
      }).finally(function () {
        sendBtn.disabled  = false;
        textarea.disabled = false;
        textarea.focus();
      });

    }).catch(function (err) {
      console.error('[Comments] Erreur vérification limite :', err);
      showFormError('Une erreur réseau est survenue. Merci de réessayer.');
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
  // SIGNALEMENT D'UN COMMENTAIRE
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️ Limite connue (acceptée en l'absence de Cloud Functions / forfait
  // Spark) : si deux personnes signalent le même commentaire quasi au même
  // instant, il est possible que le masquage se déclenche avec un
  // signalement de retard (ex : au 6e au lieu du 5e), à cause d'une lecture
  // puis écriture non transactionnelle. Le pire scénario reste "masqué un
  // peu plus tard", jamais "jamais masqué". Si tu passes un jour au plan
  // Blaze, un runTransaction() ou la Cloud Function fournie séparément
  // donnent une garantie stricte.

  // Ouvre une petite boîte de dialogue demandant le motif de signalement.
  // Implémentation légère en DOM pur (pas de dépendance externe), cohérente
  // avec le style glassmorphism du site.
  function openReportDialog(comment, triggerBtn) {
    // Évite d'ouvrir plusieurs boîtes de dialogue en même temps
    var existing = document.getElementById('lb-report-dialog-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'lb-report-dialog-overlay';
    overlay.className = 'lb-report-dialog-overlay';

    var optionsHtml = REPORT_REASONS.map(function (r) {
      return '<button class="lb-report-reason-btn" data-reason="' + r.value + '">' +
        escapeHtml(r.label) + '</button>';
    }).join('');

    overlay.innerHTML =
      '<div class="lb-report-dialog">' +
        '<h4>Signaler ce commentaire</h4>' +
        '<p class="lb-report-dialog-sub">Pourquoi souhaitez-vous signaler ce commentaire ?</p>' +
        '<div class="lb-report-reasons">' + optionsHtml + '</div>' +
        '<button class="lb-report-cancel">Annuler</button>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.lb-report-cancel').addEventListener('click', function () {
      overlay.remove();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    var reasonButtons = overlay.querySelectorAll('.lb-report-reason-btn');
    reasonButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var reason = btn.dataset.reason;
        submitReport(comment, reason, triggerBtn);
        overlay.remove();
      });
    });
  }

  function submitReport(comment, reason, triggerBtn) {
    var db   = window.__prspkDb;
    var fire = window.__prspkFire;
    var user = window.__prspkUser;
    if (!db || !fire || !user || !currentDrawingId) return;

    // Vérification défensive : si firebase-init.js / firebase.js n'a pas
    // été mis à jour avec les exports increment/arrayUnion, on le signale
    // clairement au lieu de planter silencieusement dans une Promise.
    if (typeof fire.arrayUnion !== 'function' || typeof fire.increment !== 'function') {
      console.error(
        '[Comments] fire.arrayUnion ou fire.increment manquant. ' +
        'Vérifie que firebase-init.js (ou firebase.js) exporte bien ' +
        '"arrayUnion" et "increment" dans window.__prspkFire.'
      );
      showToast('Erreur de configuration Firebase. Signalement impossible.');
      return;
    }

    // Anti double-signalement (vérif locale rapide ; la vraie garantie est
    // dans les règles Firestore, voir la section règles plus bas)
    if (reportedByMe[comment.id]) return;

    var commentRef = fire.doc(db, 'drawings', currentDrawingId, 'comments', comment.id);
    // ID déterministe : {commentId}_{reporterUid} → empêche naturellement
    // un même utilisateur de créer 2 signalements sur le même commentaire,
    // car addDoc générerait un ID aléatoire alors qu'ici on force un ID fixe
    // via setDoc + doc(), et les règles Firestore interdisent l'écrasement.
    var reportId = comment.id + '_' + user.uid;
    var reportRef = fire.doc(db, 'reports', reportId);

    fire.setDoc(reportRef, {
      commentId:   comment.id,
      commentText: comment.text,
      commentAuthorUid: comment.uid,
      reporterUid: user.uid,
      reason:      reason,
      createdAt:   fire.serverTimestamp()
    }).then(function () {
      reportedByMe[comment.id] = true;

      // ── Relecture fraîche du commentaire avant calcul ──────────────────
      // Important : `comment.reportCount` en mémoire locale peut être
      // périmé si quelqu'un d'autre a signalé entre-temps. On relit donc
      // le document juste avant d'écrire, pour calculer `hidden` à partir
      // de la vraie valeur actuelle. Si on se trompe, Firestore refusera
      // de toute façon l'update (voir règles), donc ceci évite juste une
      // erreur inutile plutôt que de représenter un risque de sécurité.
      return fire.getDoc(commentRef).then(function (freshSnap) {
        var freshData = freshSnap.data() || {};
        var currentReportCount = freshData.reportCount || 0;
        var newReportCount = currentReportCount + 1;
        var shouldHide = newReportCount >= HIDE_AT_REPORTS || freshData.hidden === true;

        return fire.updateDoc(commentRef, {
          reportCount: fire.increment(1),
          reportedBy: fire.arrayUnion(user.uid),
          hidden: shouldHide
        }).then(function () {
          return newReportCount;
        });
      });
    }).then(function (newReportCount) {
      // Reflète localement le nouvel état pour un rendu immédiat cohérent
      comment.reportCount = newReportCount;
      if (newReportCount >= HIDE_AT_REPORTS) comment.hidden = true;

      if (triggerBtn) {
        triggerBtn.textContent = 'Signalé';
        triggerBtn.disabled = true;
        triggerBtn.classList.add('is-reported');
      }
      showToast('Commentaire signalé. Merci pour votre vigilance.');
      renderComments();
    }).catch(function (err) {
      console.error('[Comments] Erreur signalement :', err);
      showToast('Impossible de signaler ce commentaire pour le moment.');
    });
  }

  // Petit toast de confirmation, réutilise le style .share-toast déjà présent
  // dans le CSS du site pour rester cohérent visuellement.
  function showToast(message) {
    var toast = document.querySelector('.share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'share-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove('visible');
      toast.classList.add('hidden');
    }, 2600);
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

  // Auth state — se déclenche potentiellement plusieurs fois (connexion,
  // déconnexion, ou résolution initiale de Firebase Auth qui peut arriver
  // avant OU après le chargement des commentaires selon la vitesse du
  // réseau). On met systématiquement à jour le formulaire ET on redessine
  // la liste si des commentaires sont déjà chargés, pour que les boutons
  // Signaler/Supprimer apparaissent correctement quel que soit l'ordre
  // d'arrivée des événements.
  document.addEventListener('prspk:auth-ready', function (e) {
    updateFormState(e.detail.user);
    renderComments();
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

  // Init immédiat si Firebase déjà prêt (module chargé avant ce script)
  if (typeof window.__prspkUser !== 'undefined') {
    updateFormState(window.__prspkUser);
  }

})();

// ============================= FIN SCRIPT-COMMENTS.JS =============================
