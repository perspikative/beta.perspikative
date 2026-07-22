// ============================= MODERATION.JS =============================
// Filtre de modération automatique pour les commentaires Perspikative.
// Détecte les mots bannis (insultes, haine, contenu sexuel, violence, spam…)
// même contournés (espaces entre lettres, tirets, chiffres à la place de
// lettres, accents, lettres répétées) et renvoie un statut "visible" ou
// "hidden" pour chaque commentaire.
//
// Utilisation (voir script-comments.js) :
//   const result = window.PrspkModeration.check(text);
//   result.flagged  -> true/false
//   result.status   -> "visible" | "hidden"
// ==============================================================================

(function () {
  'use strict';

  // ── Liste des mots bannis, classés par thème ──────────────────────────────
  // Écrits en minuscules, sans accents, sans espaces internes : la fonction
  // de normalisation se charge de ramener le texte saisi à cette même forme
  // avant comparaison. Complète cette liste librement, thème par thème.

  var BANNED_WORDS = {

    insultes: [
      'connard', 'connasse', 'con', 'conne', 'abruti', 'abrutie', 'debile',
      'idiot', 'idiote', 'imbecile', 'crétin', 'cretin', 'cretine', 'batard',
      'batarde', 'salope', 'salaud', 'pute', 'putain', 'enfoire', 'enfoiree',
      'enculé', 'encule', 'enculee', 'ordure', 'raclure', 'sale con',
      'ta gueule', 'tg', 'ferme ta gueule', 'nique ta mere', 'ntm',
      'fdp', 'fils de pute', 'trou du cul', 'trouduc', 'gros naze', 'naze',
      'looser', 'loser', 'merde', 'merdique', 'chiotte', 'bouffon',
      'bouffonne', 'demeure', 'attarde', 'attardee', 'debile mental',
      'sac a merde', 'pauvre type', 'pauvre merde'
    ],

    sexuel: [
      'salope', 'pute', 'putain', 'bite', 'penis', 'vagin', 'chatte',
      'suceuse', 'suceur', 'branleur', 'branleuse', 'baiser', 'baise',
      'nichon', 'nichons', 'cul', 'levrette', 'orgasme', 'porno',
      'pornographie', 'xxx', 'sextape', 'nude', 'nudes', 'sexto',
      'gode', 'masturbation', 'ejaculation', 'sperme'
    ],

    haine_racisme: [
      'negre', 'negro', 'bougnoule', 'bicot', 'youpin', 'feuj', 'chinetoque',
      'niakoue', 'bounty', 'sale arabe', 'sale noir', 'sale juif',
      'sale musulman', 'raton', 'pd', 'pede', 'pedale', 'tapette',
      'sale gouine', 'gouine', 'travelo', 'sale handicape', 'mongolien',
      'trisomique de merde', 'nazi', 'hitler avait raison', 'sale blanc',
      'sale chinois'
    ],

    violence_menaces: [
      'je vais te tuer', 'je vais te buter', 'je vais te frapper',
      'va crever', 'va mourir', 'crève', 'creve', 'suicide toi',
      'suicide-toi', 'vas te pendre', 'va te pendre', 'je te retrouve',
      'je sais ou tu habites', 'je vais te retrouver', 'tu vas payer',
      'je vais te defoncer', 'je vais te niquer', 'ta race', 'nique ta race'
    ],

    harcelement: [
      'grosse merde', 'personne t aime', 'personne ne t aime', 't es moche',
      'tu es moche', 't es nul', 'tu es nul', 't es null', 'degage',
      'dégage', 'casse toi', 'casse-toi', 'ferme la', 'la ferme',
      'sois maudit', 'sois maudite', 'tu sers a rien', 'tu sers à rien',
      'inutile comme toi'
    ],

    spam_arnaque: [
      'cliquez ici', 'clique ici', 'gagnez de l argent', 'gagner de l argent',
      'argent facile', 'bitcoin gratuit', 'crypto gratuit', 'onlyfans',
      'lien en bio', 'promo exclusive', 'reduction exclusive',
      'abonnez vous a mon compte', 'suivez moi sur', 'dm moi',
      'contactez moi sur whatsapp', 'gagne un iphone', 'offre limitee'
    ]

  };

  // ── Aplatit tout en une seule liste normalisée (une fois, au chargement) ──
  var FLAT_BANNED = [];
  Object.keys(BANNED_WORDS).forEach(function (theme) {
    BANNED_WORDS[theme].forEach(function (word) {
      FLAT_BANNED.push(normalizeForList(word));
    });
  });

  // ── Normalisation du texte saisi par l'utilisateur ────────────────────────
  // Objectif : ramener "c o n n a r d", "c-o-n-n-a-r-d", "c0nn4rd",
  // "connnnaaaard", "çonnard" etc. à une forme comparable à "connard".
  //
  // Étapes :
  // 1. minuscule
  // 2. suppression des accents (NFD + suppression des diacritiques)
  // 3. remplacement des chiffres/symboles couramment utilisés comme lettres
  //    (leetspeak) par leur équivalent alphabétique
  // 4. suppression de tout ce qui n'est pas une lettre a-z ou une espace
  //    (retire tirets, points, underscores, émojis, etc. utilisés comme
  //    séparateurs pour casser un mot)
  // 5. réduction des lettres répétées consécutives (aaaa -> a) pour neutraliser
  //    l'étirement ("coooonnnard")
  // 6. suppression de TOUTES les espaces internes, pour détecter "c o n n a r d"
  //    comme "connard" (on garde une version "sans espaces" en plus de la
  //    version avec espaces réduites, pour comparaison contre la liste)

  function stripDiacritics(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  var LEET_MAP = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '7': 't', '8': 'b', '@': 'a', '$': 's', '+': 't'
  };

  function replaceLeet(str) {
    return str.replace(/[013457$@+]/g, function (ch) {
      return LEET_MAP[ch] !== undefined ? LEET_MAP[ch] : ch;
    });
  }

  function collapseRepeats(str) {
    // "coooonnnard" -> "connard" (réduit toute lettre répétée 2x ou plus à 1x)
    return str.replace(/([a-z])\1+/g, '$1');
  }

  // Normalisation "de référence" pour les mots de la liste (pas besoin de
  // gérer les séparateurs internes puisqu'on les écrit déjà collés)
  function normalizeForList(str) {
    var s = str.toLowerCase();
    s = stripDiacritics(s);
    s = replaceLeet(s);
    s = collapseRepeats(s);
    s = s.replace(/[^a-z ]/g, '');
    return s.trim();
  }

  // Normalisation du texte utilisateur : on produit une version "compacte"
  // (toutes les espaces/séparateurs supprimés) pour détecter les mots cassés
  // lettre par lettre, en plus d'une version normale (espaces conservées)
  // pour détecter les expressions à plusieurs mots ("va te pendre").
  function normalizeUserText(str) {
    var s = str.toLowerCase();
    s = stripDiacritics(s);
    s = replaceLeet(s);

    // Version avec espaces conservées (pour les expressions multi-mots)
    var withSpaces = s.replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ');
    withSpaces = collapseRepeats(withSpaces).trim();

    // Version totalement compacte (pour détecter "c o n n a r d", "c-o-n.n_a r d")
    var compact = s.replace(/[^a-z]/g, '');
    compact = collapseRepeats(compact);

    return { withSpaces: withSpaces, compact: compact };
  }

  // ── Vérifie si un texte contient un mot/expression bannie ────────────────
  function containsBannedContent(text) {
    if (!text || !text.trim()) return false;

    var normalized = normalizeUserText(text);

    for (var i = 0; i < FLAT_BANNED.length; i++) {
      var banned = FLAT_BANNED[i];
      if (!banned) continue;

      // Cas 1 : expression avec espaces (ex: "va te pendre") -> recherche
      // par mot entier dans la version avec espaces, pour éviter les faux
      // positifs du type "con" dans "concert"
      if (banned.indexOf(' ') !== -1) {
        if ((' ' + normalized.withSpaces + ' ').indexOf(' ' + banned + ' ') !== -1) {
          return true;
        }
        // Filet de sécurité : même expression, mais espacée/cassée par la
        // personne ("v a t e p e n d r e")
        var bannedCompact = banned.replace(/ /g, '');
        if (bannedCompact && normalized.compact.indexOf(bannedCompact) !== -1) {
          return true;
        }
        continue;
      }

      // Cas 2 : mot simple -> recherche en mot entier dans la version avec
      // espaces (évite "con" dans "concert", "cul" dans "recul", etc.)
      var wordBoundaryRegex = new RegExp('(^|\\s)' + escapeRegex(banned) + '(\\s|$)');
      if (wordBoundaryRegex.test(normalized.withSpaces)) {
        return true;
      }

      // Cas 3 : même mot mais écrit lettre par lettre / avec séparateurs
      // ("c o n n a r d", "c.o.n.n.a.r.d") -> recherche dans la version compacte.
      // On exige une longueur minimale de 3 pour éviter des faux positifs
      // trop fréquents sur des mots très courts.
      if (banned.length >= 3 && normalized.compact.indexOf(banned) !== -1) {
        return true;
      }
    }

    return false;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── API publique ──────────────────────────────────────────────────────────
  // check(text) renvoie { flagged: bool, status: "visible"|"hidden" }
  // Le texte ORIGINAL doit toujours être stocké tel quel dans Firestore
  // (jamais modifié/censuré) : seul le statut change l'affichage côté client.
  function check(text) {
    var flagged = containsBannedContent(text);
    return {
      flagged: flagged,
      status: flagged ? 'hidden' : 'visible'
    };
  }

  window.PrspkModeration = {
    check: check,
    // Exposé au cas où tu veuilles tester/déboguer en console :
    // window.PrspkModeration._normalize("c o n n a r d")
    _normalize: normalizeUserText
  };

})();

// ============================= FIN MODERATION.JS =============================
