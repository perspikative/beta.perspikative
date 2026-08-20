/* Perspikative AI — system.js
 * Moteur local : compréhension, recherche, intentions et réponses.
 * Dépendance : base.js doit être chargé avant ce fichier.
 *
 * Usage futur :
 * <script src="https://raw.githubusercontent.com/perspikative/perspikative-ai/main/base.js"></script>
 * <script src="https://raw.githubusercontent.com/perspikative/perspikative-ai/main/system.js"></script>
 *
 * Puis :
 *
 * PerspikativeAI.ask("combien de créations ?");
 */

(function (global) {
  "use strict";

  const DB = global.PERSPIKATIVE_BASE;

  if (!DB) {
    throw new Error(
      "Perspikative AI: base.js doit être chargé avant system.js."
    );
  }

  const CONFIG = {
    language: "fr",
    repository:
      "https://github.com/perspikative/perspikative-ai",

    remoteCalls: false,

    maxFacts: 6,

    minConfidence: 0.34,

    maxAnswerSentences: 7
  };

  const STOPWORDS = new Set(
    `
    a au aux avec ce ceci cela de des du en et est elle elles il ils je la le les
    ma mais me mon ne nos notre nous on ou par pour que quel quelle quels quelles
    qui sans se ses sur ta tes ton tu un une vous vos votre y dans plus très
    peut peux peut-on comment pourquoi quand combien où ou quoi c'est
    `
      .trim()
      .split(/\s+/)
  );

  const SYNONYMS = {
    "dessin": [
      "creation",
      "creations",
      "oeuvre",
      "oeuvres"
    ],

    "œuvre": [
      "creation",
      "creations",
      "oeuvre",
      "oeuvres"
    ],

    "oeuvre": [
      "creation",
      "creations",
      "oeuvre",
      "oeuvres"
    ],

    "création": [
      "creation",
      "creations"
    ],

    "creations": [
      "creation",
      "oeuvre",
      "oeuvres"
    ],

    "concours": [
      "challenge",
      "art"
    ],

    "challenge": [
      "concours",
      "art"
    ],

    "actu": [
      "actus",
      "actualite",
      "nouveautes"
    ],

    "actualite": [
      "actus",
      "nouveautes"
    ],

    "equipe": [
      "perspikateam",
      "team"
    ],

    "équipe": [
      "perspikateam",
      "team"
    ],

    "membre": [
      "profil",
      "utilisateur",
      "communaute"
    ],

    "artiste": [
      "createur",
      "créateur",
      "creation"
    ],

    "date": [
      "deadline",
      "limite"
    ],

    "limite": [
      "deadline",
      "date"
    ],

    "prix": [
      "recompense",
      "recompenses",
      "gagnant"
    ],

    "recompense": [
      "prix",
      "recompenses"
    ],

    "participer": [
      "inscription",
      "participation"
    ],

    "inscription": [
      "participer",
      "participation"
    ]
  };

  const INTENTS = [
    {
      id: "portfolio.creationCount",

      patterns: [
        /\bcombien\b.*\b(création|creation|créations|creations|œuvres?|oeuvres?|dessins?)\b/,
        /\bnombre\b.*\b(création|creation|œuvres?|oeuvres?|dessins?)\b/,
        /\bportfolio\b.*\bcombien\b/,
        /\bcombien\b.*\bportfolio\b/
      ]
    },

    {
      id: "portfolio.location",

      patterns: [
        /\bou\b.*\b(création|creation|œuvre|oeuvre|portfolio|dessin)\b/,
        /\bvoir\b.*\b(création|creation|œuvre|oeuvre|dessin)\b/,
        /\btrouver\b.*\b(création|creation|œuvre|oeuvre)\b/
      ]
    },

    {
      id: "about.site",

      patterns: [
        /\bquoi\b.*\bperspikative\b/,
        /\bc'est quoi\b.*\bperspikative\b/,
        /\bbut\b.*\bperspikative\b/,
        /\bprésente\b.*\bperspikative\b/
      ]
    },

    {
      id: "actus.latest",

      patterns: [
        /\bactus?\b/,
        /\bnouveaut(é|e)s\b/,
        /\bquoi de neuf\b/,
        /\bactualit(é|e)s\b/
      ]
    },

    {
      id: "challenge.what",

      patterns: [
        /\bc'est quoi\b.*\b(art challenge|challenge)\b/,
        /\b(art challenge|challenge)\b.*\bquoi\b/,
        /\bconcours\b.*\bperspikative\b/
      ]
    },

    {
      id: "challenge.deadline",

      patterns: [
        /\b(date|deadline|limite)\b.*\b(challenge|concours|particip)/,
        /\b(quand|jusqu'à quand)\b.*\b(challenge|concours)\b/
      ]
    },

    {
      id: "challenge.eligibility",

      patterns: [
        /\bqui\b.*\b(particip|inscri|concours|challenge)\b/,
        /\best-ce\b.*\b(participer|ouvert)\b/
      ]
    },

    {
      id: "challenge.format",

      patterns: [
        /\bformat(s)?\b/,
        /\bjpg\b|\bjpeg\b|\bpng\b|\bpdf\b|\bwebp\b|\bgif\b/,
        /\brésolution\b|\bresolution\b/
      ]
    },

    {
      id: "challenge.rewards",

      patterns: [
        /\b(prix|récompense|recompense|gagnant)\b/,
        /\bqu'est-ce qu'on gagne\b/,
        /\bque gagne\b/
      ]
    },

    {
      id: "community.what",

      patterns: [
        /\bcommunauté\b|\bcommunaute\b|\bcommu\b/,
        /\bdiscuter\b.*\bperspikative\b/
      ]
    },

    {
      id: "team.what",

      patterns: [
        /\bperspikateam\b/,
        /\bqui\b.*\béquipe\b|\bqui\b.*\bequipe\b/
      ]
    },

    {
      id: "beta.what",

      patterns: [
        /\bbeta\b/,
        /\bprogramme\b.*\btest\b/
      ]
    },

    {
      id: "search.what",

      patterns: [
        /\brecherche\b/,
        /\bchercher\b/,
        /\bmoteur\b.*\brecherche\b/
      ]
    },

    {
      id: "ai.what",

      patterns: [
        /\bia\b/,
        /\bintelligence artificielle\b/,
        /\bentrainement\b.*\bmodèle\b/
      ]
    }
  ];

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(value) {
    return normalize(value)
      .split(/\s+/)
      .filter(
        token =>
          token &&
          !STOPWORDS.has(token) &&
          token.length > 2
      );
  }

  function expand(tokens) {
    const out = new Set(tokens);

    for (const token of tokens) {
      for (const alias of SYNONYMS[token] || []) {
        out.add(normalize(alias));
      }
    }

    return [...out];
  }

  function flatten(object, path = [], out = []) {
    if (object == null) {
      return out;
    }

    if (
      typeof object === "string" ||
      typeof object === "number" ||
      typeof object === "boolean"
    ) {
      out.push({
        path: path.join("."),
        value: String(object)
      });

      return out;
    }

    if (Array.isArray(object)) {
      object.forEach(
        (item, index) =>
          flatten(
            item,
            [...path, String(index)],
            out
          )
      );

      return out;
    }

    Object.entries(object).forEach(
      ([key, value]) =>
        flatten(
          value,
          [...path, key],
          out
        )
    );

    return out;
  }

  const flat = flatten(DB).filter(
    x =>
      !x.path.startsWith("meta.policy") &&
      x.path !== "meta.repository"
  );

  function matchTerms(question, item) {
    const qTokens = expand(
      tokenize(question)
    );

    const hay = normalize(
      `${item.path} ${item.value}`
    );

    if (!qTokens.length) {
      return 0;
    }

    let hits = 0;

    for (const token of qTokens) {
      if (hay.includes(token)) {
        hits++;
      }
    }

    return hits / qTokens.length;
  }

  function detectIntent(question) {
    const q = normalize(question);

    for (const intent of INTENTS) {
      if (
        intent.patterns.some(
          pattern => pattern.test(q)
        )
      ) {
        return intent.id;
      }
    }

    return null;
  }

  function intentBonus(intent, item) {
    if (!intent) {
      return 0;
    }

    const p = item.path;

    const map = {
      "portfolio.creationCount": [
        "portfolio.sections.creations.currentCount",
        "portfolio.facts"
      ],

      "portfolio.location": [
        "portfolio.sections.creations.url",
        "portfolio.sections.illustrations.url",
        "portfolio.sections.projets.url"
      ],

      "about.site": [
        "site.name",
        "site.type",
        "site.description",
        "site.tagline"
      ],

      "actus.latest": [
        "actus.url",
        "actus.facts"
      ],

      "challenge.what": [
        "artChallenge.name",
        "artChallenge.description"
      ],

      "challenge.deadline": [
        "artChallenge.currentEdition.deadline",
        "artChallenge.currentEdition.status"
      ],

      "challenge.eligibility": [
        "artChallenge.eligibility"
      ],

      "challenge.format": [
        "artChallenge.acceptedFiles",
        "artChallenge.imageRequirements"
      ],

      "challenge.rewards": [
        "artChallenge.prizes"
      ],

      "community.what": [
        "community"
      ],

      "team.what": [
        "perspikateam"
      ],

      "beta.what": [
        "betaProgram"
      ],

      "search.what": [
        "features.search"
      ],

      "ai.what": [
        "legal.ai",
        "technology"
      ]
    };

    const prefixes =
      map[intent] || [];

    return prefixes.some(
      prefix =>
        p === prefix ||
        p.startsWith(prefix + ".")
    )
      ? 0.6
      : 0;
  }

  function retrieve(question) {
    const intent =
      detectIntent(question);

    return flat
      .map(item => {
        const lexical =
          matchTerms(question, item);

        const bonus =
          intentBonus(
            intent,
            item
          );

        const exact =
          normalize(item.value) ===
          normalize(question)
            ? 0.25
            : 0;

        return {
          ...item,
          score:
            lexical * 0.72 +
            bonus +
            exact
        };
      })

      .filter(
        item =>
          item.score >=
          CONFIG.minConfidence
      )

      .sort(
        (a, b) =>
          b.score - a.score
      )

      .slice(
        0,
        CONFIG.maxFacts
      );
  }

  function findPath(path) {
    const parts =
      String(path).split(".");

    let current = DB;

    for (const part of parts) {
      if (current == null) {
        return undefined;
      }

      current =
        current[part];
    }

    return current;
  }

  function formatDate(iso) {
    const date =
      new Date(iso);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return iso;
    }

    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    ).format(date);
  }

  function sentence(value) {
    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function answerByIntent(
    question,
    facts,
    intent
  ) {

    if (
      intent ===
      "portfolio.creationCount"
    ) {
      const count =
        findPath(
          "portfolio.sections.creations.currentCount"
        );

      return `Le portfolio de Perspikative compte actuellement **${count} créations** dans cette base. Elles sont regroupées dans la section « Créations » du portfolio. Ce nombre doit être actualisé dès qu'une nouvelle œuvre est publiée.`;
    }

    if (
      intent ===
      "portfolio.location"
    ) {
      return "Tu peux retrouver les œuvres dans le **Portfolio** de Perspikative, notamment dans la section « Créations ». Le portfolio comprend aussi les sections « Illustrations » et « Projets ».";
    }

    if (
      intent ===
      "about.site"
    ) {
      return `Perspikative est un **projet artistique personnel et un univers créatif**. Le site rassemble des créations, des illustrations, des projets, des actualités et des espaces communautaires. L'objectif est de proposer un endroit où découvrir, suivre et partager un univers de création visuelle.`;
    }

    if (
      intent ===
      "actus.latest"
    ) {
      const news =
        DB.actus.facts || [];

      if (!news.length) {
        return null;
      }

      return `Dans ma base locale, les actualités enregistrées comprennent notamment **${news[0].title}** (${formatDate(news[0].date)}), consacré à ${news[0].summary.toLowerCase()} ${
        news[1]
          ? `Une autre actu enregistrée est **${news[1].title}** (${formatDate(news[1].date)}), ${news[1].summary.toLowerCase()}.`
          : ""
      }`;
    }

    if (
      intent ===
      "challenge.what"
    ) {
      return `Le **ART Challenge** est le concours artistique de Perspikative. L'édition enregistrée ici est la 4e édition, avec un **thème libre** et **aucune contrainte** annoncée. Le concours est conçu pour mettre en avant la créativité et les œuvres de la communauté.`;
    }

    if (
      intent ===
      "challenge.deadline"
    ) {
      const d =
        DB.artChallenge
          .currentEdition
          .deadline;

      return `Pour l'édition actuellement enregistrée, la date limite était le **${formatDate(d)} à minuit (UTC+2)**. La base indique que cette édition est **close** ; il faut donc se référer à Perspikative pour la prochaine ouverture.`;
    }

    if (
      intent ===
      "challenge.eligibility"
    ) {
      return `Le ART Challenge est présenté comme **ouvert à tous** : débutants, artistes confirmés et amateurs créatifs peuvent participer. Tous les styles et médiums sont les bienvenus tant qu'ils respectent les consignes de l'édition.`;
    }

    if (
      intent ===
      "challenge.format"
    ) {
      const files =
        DB.artChallenge
          .acceptedFiles
          .join(", ");

      return `Les formats de fichier enregistrés comme acceptés sont **${files}**. La version détaillée des consignes indique aussi une résolution minimale de **1080 px** pour l'image rendue.`;
    }

    if (
      intent ===
      "challenge.rewards"
    ) {
      return `Les récompenses sont pensées autour de la **visibilité et de la reconnaissance**, pas d'un gain financier. Trois places sont prévues. Selon le tableau de récompenses enregistré, les premiers prix peuvent notamment recevoir une mise en avant dans la galerie et sur les réseaux, une story dédiée, un badge et d'autres avantages propres à leur classement.`;
    }

    if (
      intent ===
      "community.what"
    ) {
      return `La communauté Perspikative rassemble les personnes qui suivent le projet, ses œuvres et ses événements. Elle joue notamment un rôle dans le **vote du ART Challenge** et dans la vie générale du site.`;
    }

    if (
      intent ===
      "team.what"
    ) {
      return `La **Perspikateam** est l'équipe bénévole qui participe au développement, à la gestion et à l'animation de Perspikative.`;
    }

    if (
      intent ===
      "beta.what"
    ) {
      return `Le **Perspikative Beta Program** permet de tester certaines fonctionnalités avant leur publication générale. La version beta est distincte du site principal.`;
    }

    if (
      intent ===
      "search.what"
    ) {
      return `Perspikative possède un système de **recherche** conçu pour retrouver plus facilement son contenu et tolérer certaines différences de saisie.`;
    }

    if (
      intent ===
      "ai.what"
    ) {
      return `Perspikative possède une page dédiée à sa position sur l'IA. Pour cet assistant local, l'idée est de privilégier une base de connaissances contrôlée et de ne pas utiliser les images des œuvres comme données d'entraînement. Je ne présenterai pas cela comme une garantie absolue sur tout modèle tiers qui pourrait être ajouté plus tard.`;
    }

    if (!facts.length) {
      return null;
    }

    const unique = [];

    for (const fact of facts) {
      const s =
        sentence(fact.value);

      if (
        s &&
        !unique.includes(s)
      ) {
        unique.push(s);
      }

      if (
        unique.length >= 4
      ) {
        break;
      }
    }

    return unique.length
      ? `Voici ce que j'ai trouvé dans la base Perspikative :\n\n${unique
          .map(x => `• ${x}`)
          .join("\n")}`
      : null;
  }

  function generate(
    question,
    options = {}
  ) {

    const text =
      String(
        question || ""
      ).trim();

    if (!text) {
      return {
        answer:
          "Pose-moi une question sur Perspikative.",

        intent: null,

        confidence: 0,

        sources: []
      };
    }

    const intent =
      detectIntent(text);

    const facts =
      retrieve(text);

    const response =
      answerByIntent(
        text,
        facts,
        intent
      );

    if (response) {
      return {
        answer: response,

        intent,

        confidence:
          intent
            ? 0.98
            : Math.min(
                0.9,
                facts[0]?.score || 0
              ),

        sources:
          facts.map(
            f => f.path
          )
      };
    }

    return {
      answer:
        "Je n'ai pas trouvé assez d'informations fiables dans ma base pour répondre précisément. Je préfère te le dire plutôt que d'inventer une information sur Perspikative.",

      intent,

      confidence: 0,

      sources: []
    };
  }

  function ask(
    question,
    options
  ) {
    return generate(
      question,
      options
    );
  }

  const API = {
    config: CONFIG,
    database: DB,
    normalize,
    tokenize,
    detectIntent,
    retrieve,
    generate,
    ask
  };

  global.PerspikativeAI =
    API;

  if (
    typeof module !==
    "undefined"
  ) {
    module.exports = API;
  }

})(
  typeof window !==
    "undefined"
    ? window
    : globalThis
);