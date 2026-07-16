// ============================= RATE-LIMIT.JS =============================
// Gestion de la limite quotidienne (10/jour) par utilisateur.
//
// Structure Firestore utilisée (alignée sur firestore.rules du site) :
//   commentLimits/{uid}
//     { uid, date, count, lastCommentAt }
//
// Un seul document par utilisateur. Le champ `date` (format "YYYY-MM-DD")
// sert à savoir si le compteur doit être remis à zéro. Reset "à minuit"
// (date calendaire), cohérent avec le message "revenez demain".
//
// Note : le cooldown entre deux commentaires (30s) a été retiré à la
// demande — uniquement la limite quotidienne est appliquée désormais.
// ============================================================================

(function () {
  'use strict';

  var DAILY_LIMIT = 10;

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
   */
  function canSendComment(uid) {
    var db = window.__prspkDb;
    var fire = window.__prspkFire;
    var docRef = fire.doc(db, 'commentLimits', uid);

    return fire.getDoc(docRef).then(function (snap) {
      if (!snap.exists()) {
        return { allowed: true };
      }
      var data = snap.data();

      // Le compteur est d'un autre jour : considéré comme réinitialisé.
      if (data.date !== todayKey()) {
        return { allowed: true };
      }

      var count = data.count || 0;
      if (count >= DAILY_LIMIT) {
        return { allowed: false, reason: 'daily_limit' };
      }

      return { allowed: true };
    });
  }

  /**
   * À appeler juste APRÈS confirmation que le commentaire a bien été
   * enregistré dans Firestore. Incrémente le compteur du jour, ou le
   * réinitialise à 1 si on a changé de jour depuis la dernière fois.
   */
  function registerCommentSent(uid) {
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

  window.__prspkRateLimit = {
    DAILY_LIMIT: DAILY_LIMIT,
    canSendComment: canSendComment,
    registerCommentSent: registerCommentSent
  };

})();

// ============================= FIN RATE-LIMIT.JS =============================
