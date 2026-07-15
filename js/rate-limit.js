// ============================= RATE-LIMIT.JS =============================
// Gestion de la limite quotidienne (10/jour) et du cooldown (30s) entre
// deux commentaires.
//
// Structure Firestore utilisée (alignée sur firestore.rules du site) :
//   commentLimits/{uid}
//     { uid, date, count, lastCommentAt }
//
// Un seul document par utilisateur (pas un par jour) : le champ `date`
// (format "YYYY-MM-DD") sert à savoir si le compteur doit être remis à
// zéro. Reset "à minuit" (date calendaire), cohérent avec le message
// "revenez demain".
// ============================================================================

(function () {
  'use strict';

  var DAILY_LIMIT = 10;
  var COOLDOWN_MS = 30 * 1000; // 30 secondes

  // Cache local du dernier envoi, pour ne pas taper Firestore juste pour
  // vérifier le cooldown pendant la session en cours.
  var lastLocalSendAt = 0;

  function todayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * Vérifie si l'utilisateur peut publier un commentaire MAINTENANT.
   * Lecture seule — l'incrémentation se fait séparément dans
   * registerCommentSent(), APRÈS confirmation d'écriture du commentaire.
   *
   * Retourne une Promise résolue avec :
   *   { allowed: true }
   *   { allowed: false, reason: 'daily_limit' }
   *   { allowed: false, reason: 'cooldown', remainingMs: number }
   */
  function canSendComment(uid) {
    // Vérif cooldown locale d'abord (gratuite, pas de lecture Firestore)
    var elapsed = Date.now() - lastLocalSendAt;
    if (lastLocalSendAt > 0 && elapsed < COOLDOWN_MS) {
      return Promise.resolve({
        allowed: false,
        reason: 'cooldown',
        remainingMs: COOLDOWN_MS - elapsed
      });
    }

    var db = window.__prspkDb;
    var fire = window.__prspkFire;
    var docRef = fire.doc(db, 'commentLimits', uid);

    return fire.getDoc(docRef).then(function (snap) {
      if (!snap.exists()) {
        return { allowed: true };
      }
      var data = snap.data();

      // Le compteur est d'un autre jour : on considère la limite comme
      // réinitialisée (registerCommentSent() remettra count à 1 et
      // écrasera `date`).
      if (data.date !== todayKey()) {
        return { allowed: true };
      }

      var count = data.count || 0;
      if (count >= DAILY_LIMIT) {
        return { allowed: false, reason: 'daily_limit' };
      }

      // Double vérification du cooldown côté serveur (au cas où
      // lastLocalSendAt aurait été perdu, ex: rechargement de page)
      if (data.lastCommentAt) {
        var lastTs = data.lastCommentAt.toDate
          ? data.lastCommentAt.toDate().getTime()
          : data.lastCommentAt;
        var remaining = COOLDOWN_MS - (Date.now() - lastTs);
        if (remaining > 0) {
          return { allowed: false, reason: 'cooldown', remainingMs: remaining };
        }
      }

      return { allowed: true };
    });
  }

  /**
   * À appeler juste APRÈS confirmation que le commentaire a bien été
   * enregistré dans Firestore. Incrémente le compteur du jour, ou le
   * réinitialise à 1 si on a changé de jour depuis la dernière fois.
   *
   * On relit le document juste avant d'écrire pour décider s'il faut
   * incrémenter ou repartir à 1 — pas d'increment() atomique possible ici
   * car le "reset quotidien" dépend d'une condition (changement de date),
   * ce que Firestore ne sait pas exprimer nativement dans une seule
   * écriture. Le petit risque de race condition (deux envois quasi
   * simultanés au moment exact du changement de jour) est négligeable en
   * pratique.
   */
  function registerCommentSent(uid) {
    lastLocalSendAt = Date.now();

    var db = window.__prspkDb;
    var fire = window.__prspkFire;
    var docRef = fire.doc(db, 'commentLimits', uid);
    var today = todayKey();

    return fire.getDoc(docRef).then(function (snap) {
      var isNewDay = !snap.exists() || snap.data().date !== today;

      return fire.setDoc(docRef, {
        uid: uid,
        date: today,
        count: isNewDay ? 1 : fire.increment(1),
        lastCommentAt: fire.serverTimestamp()
      }, { merge: true });
    });
  }

  /**
   * Démarre un compte à rebours visuel sur un bouton pendant le cooldown.
   * `button` : élément DOM du bouton d'envoi
   * `labelWhenReady` : texte à remettre une fois le cooldown terminé
   */
  function startCooldownUI(button, remainingMs, labelWhenReady) {
    if (!button) return;
    var endsAt = Date.now() + remainingMs;
    button.disabled = true;

    function tick() {
      var msLeft = endsAt - Date.now();
      if (msLeft <= 0) {
        button.disabled = false;
        button.textContent = labelWhenReady || 'Publier';
        return;
      }
      var secondsLeft = Math.ceil(msLeft / 1000);
      button.textContent = 'Publier (' + secondsLeft + ' s)';
      requestAnimationFrame(tick);
    }
    tick();
  }

  window.__prspkRateLimit = {
    DAILY_LIMIT: DAILY_LIMIT,
    COOLDOWN_MS: COOLDOWN_MS,
    canSendComment: canSendComment,
    registerCommentSent: registerCommentSent,
    startCooldownUI: startCooldownUI
  };

})();

// ============================= FIN RATE-LIMIT.JS =============================
