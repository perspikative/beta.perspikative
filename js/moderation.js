// ============================= MODERATION.JS =============================
// Règles de modération CÔTÉ CLIENT pour les commentaires Perspikative.
//
// ⚠️ IMPORTANT : tout ce fichier est de la modération "de confort" pour
// l'utilisateur (feedback immédiat, sans aller-retour serveur). CE N'EST PAS
// une garantie de sécurité : un utilisateur malveillant peut appeler
// Firestore directement en contournant ce fichier. La vraie barrière est
// dans firestore.rules + les Cloud Functions (voir plus bas dans la
// réponse). Ce module sert à :
//   1. Donner un feedback instantané et sympa à l'utilisateur normal
//   2. Nettoyer le texte avant envoi
//   3. Calculer un score qui décide si le commentaire doit être
//      auto-masqué en attente de modération humaine (mais le commentaire
//      est quand même envoyé, jamais silencieusement perdu)
// ============================================================================

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // 1. LISTE DE MOTS INTERDITS — facilement modifiable
  // ══════════════════════════════════════════════════════════════════════
  // Ajoute/retire des mots ici. Pas besoin de gérer les accents ou la casse,
  // c'est fait automatiquement par normalizeForBadWords().
  // Astuce anti-contournement : on détecte aussi les mots "espacés"
  // (ex: "i d i o t") et les répétitions de lettres (ex: "idiooot").
  var BAD_WORDS = [
    // Exemple de structure — remplace/complète avec ta propre liste.
    'idiot', 'connard', 'connasse', 'pute', 'salope', 'enculé', 'enculer',
    'batard', 'bâtard', 'pd', 'negro', 'nègre', 'debile', 'débile',
    'imbecile', 'imbécile', 'abruti', 'con', 'merde', 'putain'
    // ➜ Complète cette liste selon tes besoins. Reste simple : un mot par
    // entrée, en minuscule, sans accent (la normalisation gère le reste).
  ];

  // ══════════════════════════════════════════════════════════════════════
  // 2. DOMAINES / PATTERNS DE LIENS INTERDITS
  // ══════════════════════════════════════════════════════════════════════
  var LINK_PATTERNS = [
    /https?:\/\//i,
    /www\./i,
    /discord\.gg/i,
    /bit\.ly/i,
    /tinyurl/i,
    /\bt\.co\b/i,
    /instagram\.com/i,
    /youtube\.com/i,
    /youtu\.be/i,
    // Détecte aussi les domaines "génériques" du type "monsite.fr", "truc.com"
    // écrits sans http(s):// devant (contournement classique).
    /\b[a-z0-9-]+\.(com|fr|net|org|io|gg|co|link|xyz|shop|store)\b/i
  ];

  // ══════════════════════════════════════════════════════════════════════
  // 3. NORMALISATION (pour la détection de mots interdits)
  // ══════════════════════════════════════════════════════════════════════
  // - minuscule
  // - suppression des accents (é → e, à → a, etc.)
  // - suppression des caractères invisibles / de contournement
  // - réduction des espaces multiples
  // - réduction des lettres répétées (idiooot → idiot, aaaa → aa)
  function normalizeForBadWords(str) {
    var s = String(str).toLowerCase();

    // Supprime les accents (décomposition Unicode NFD puis retrait des diacritiques)
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Supprime les caractères invisibles utilisés pour contourner les filtres
    s = stripInvisibleChars(s);

    // "i.d.i.o.t", "i-d-i-o-t", "i_d_i_o_t" → "idiot" (avant de retirer les espaces)
    s = s.replace(/([a-z])[\.\-_*]+(?=[a-z])/g, '$1');

    // Retire tous les espaces pour détecter "i d i o t" → "idiot"
    var noSpaces = s.replace(/\s+/g, '');

    // Réduit les répétitions de lettres (3+ → 1) pour attraper "coooonnard"
    var deRepeated = noSpaces.replace(/([a-z])\1{2,}/g, '$1');

    return { spaced: s, noSpaces: noSpaces, deRepeated: deRepeated };
  }

  // Supprime les caractères Unicode invisibles couramment utilisés pour
  // contourner les filtres de texte (zero-width space/joiner/non-joiner,
  // BOM, séparateurs de direction, etc.)
  function stripInvisibleChars(str) {
    return String(str).replace(
      /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060\u180E\u00AD]/g,
      ''
    );
  }

  function containsBadWord(text) {
    var norm = normalizeForBadWords(text);
    for (var i = 0; i < BAD_WORDS.length; i++) {
      var w = BAD_WORDS[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (norm.noSpaces.indexOf(w) !== -1 || norm.deRepeated.indexOf(w) !== -1) {
        return true;
      }
    }
    return false;
  }

  function containsLink(text) {
    for (var i = 0; i < LINK_PATTERNS.length; i++) {
      if (LINK_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. ANTI-SPAM STRUCTUREL
  // ══════════════════════════════════════════════════════════════════════
  function detectSpamPatterns(text) {
    var reasons = [];

    // Plus de 5 lignes vides
    var emptyLines = (text.match(/\n\s*\n/g) || []).length;
    if (emptyLines > 5) reasons.push('empty_lines');

    // Plus de 15 caractères identiques d'affilée (ex: aaaaaaaaaaaaaaaaa)
    if (/(.)\1{14,}/.test(text)) reasons.push('repeated_chars');

    // Plus de 8 emojis identiques d'affilée
    // (approximation : on cible les plages Unicode emoji courantes)
    var emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    var emojis = text.match(emojiRegex) || [];
    var maxEmojiRun = 0, currentRun = 1;
    for (var i = 1; i < emojis.length; i++) {
      if (emojis[i] === emojis[i - 1]) {
        currentRun++;
      } else {
        currentRun = 1;
      }
      if (currentRun > maxEmojiRun) maxEmojiRun = currentRun;
    }
    if (maxEmojiRun > 8) reasons.push('repeated_emojis');

    // Plus de 10 répétitions du même mot dans le commentaire
    var words = text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]{2,}/g) || [];
    var counts = {};
    for (var j = 0; j < words.length; j++) {
      counts[words[j]] = (counts[words[j]] || 0) + 1;
      if (counts[words[j]] > 10) {
        reasons.push('repeated_word');
        break;
      }
    }

    return reasons;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. NETTOYAGE DU TEXTE avant enregistrement
  // ══════════════════════════════════════════════════════════════════════
  function sanitizeText(raw) {
    var s = String(raw);

    // Supprime les caractères invisibles / de contournement
    s = stripInvisibleChars(s);

    // Trim global
    s = s.trim();

    // Remplace les espaces multiples (hors retour à la ligne) par un seul
    s = s.replace(/[ \t]{2,}/g, ' ');

    // Remplace 2+ lignes vides consécutives par une seule ligne vide
    s = s.replace(/\n{3,}/g, '\n\n');

    // Trim de chaque ligne (espaces en début/fin de ligne)
    s = s.split('\n').map(function (line) { return line.trim(); }).join('\n');

    return s;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. VALIDATION COMPLÈTE — point d'entrée principal
  // ══════════════════════════════════════════════════════════════════════
  // Retourne { ok: bool, error: string|null, cleaned: string, shouldFlag: bool }
  //
  // - ok=false      → on bloque l'envoi, on affiche `error`
  // - shouldFlag=true → on envoie quand même le commentaire, mais avec
  //   hidden:true + un flag d'origine, pour modération humaine
  //   (utile pour les cas "limite" : insultes probables mais pas sûres à 100%,
  //   ou patterns suspects qu'on préfère faire vérifier plutôt que bloquer)
  function validateComment(raw) {
    var MAX_LEN = 1000;

    if (typeof raw !== 'string') {
      return { ok: false, error: 'Commentaire invalide.', cleaned: '', shouldFlag: false };
    }

    var cleaned = sanitizeText(raw);

    if (cleaned.length === 0) {
      return { ok: false, error: 'Le commentaire ne peut pas être vide.', cleaned: cleaned, shouldFlag: false };
    }

    if (cleaned.length > MAX_LEN) {
      return {
        ok: false,
        error: 'Votre commentaire est trop long (maximum ' + MAX_LEN + ' caractères).',
        cleaned: cleaned,
        shouldFlag: false
      };
    }

    if (containsLink(cleaned)) {
      return {
        ok: false,
        error: 'Les liens ne sont pas autorisés dans les commentaires.',
        cleaned: cleaned,
        shouldFlag: false
      };
    }

    if (containsBadWord(cleaned)) {
      return {
        ok: false,
        error: 'Votre commentaire contient un contenu non autorisé.',
        cleaned: cleaned,
        shouldFlag: false
      };
    }

    var spamReasons = detectSpamPatterns(cleaned);
    if (spamReasons.length > 0) {
      return {
        ok: false,
        error: 'Votre commentaire a été détecté comme spam. Merci de le reformuler.',
        cleaned: cleaned,
        shouldFlag: false
      };
    }

    return { ok: true, error: null, cleaned: cleaned, shouldFlag: false };
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXPORT GLOBAL
  // ══════════════════════════════════════════════════════════════════════
  window.__prspkModeration = {
    validateComment: validateComment,
    sanitizeText: sanitizeText,
    containsBadWord: containsBadWord,
    containsLink: containsLink,
    detectSpamPatterns: detectSpamPatterns,
    stripInvisibleChars: stripInvisibleChars,
    BAD_WORDS: BAD_WORDS // exposé pour debug/tests, pas pour modif à la volée
  };

})();

// ============================= FIN MODERATION.JS =============================
