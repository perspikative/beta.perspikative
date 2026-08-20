/* Perspikative AI — base.js
 * Source de vérité textuelle locale.
 * Ne contient pas de code de génération.
 * Mise à jour manuelle recommandée quand le site évolue.
 */
const PERSPIKATIVE_BASE = {
  meta: {
    name: "Perspikative",
    language: "fr",
    version: "0.1.0",
    updated: "2026-08-20",
    repository: "https://github.com/perspikative/perspikative-ai",
    policy: {
      imagesUsedForTraining: false,
      remoteLLMRequired: false,
      answerUnknowns: false
    }
  },

  site: {
    name: "Perspikative",
    type: "portfolio artistique et univers créatif",
    description:
      "Perspikative est un projet artistique personnel qui rassemble des créations, des illustrations, des projets, des actualités et des espaces communautaires.",
    homepage: "https://perspikative.com/",
    tagline: "Plonge dans l'univers de Perspikative",
    navigation: [
      "Accueil",
      "Portfolio",
      "Actus",
      "Contact",
      "FAQ",
      "ART Challenge",
      "Communauté"
    ],
    social: [
      "WhatsApp",
      "Instagram",
      "YouTube",
      "Pinterest"
    ],
    legalPages: [
      "Mentions légales",
      "Politique de confidentialité",
      "Position sur l'IA"
    ],
    facts: [
      "Le site met en avant un univers de création visuelle et d'idées en mouvement.",
      "Le portfolio est accessible depuis la navigation principale.",
      "La page Actus est une section importante du site.",
      "Le ART Challenge dispose de sa propre page.",
      "Le site propose une page FAQ.",
      "Le site propose une section Communauté.",
      "Les pages légales comprennent notamment les mentions légales et la politique de confidentialité."
    ]
  },

  portfolio: {
    sections: {
      creations: {
        title: "Créations",
        currentCount: 44,
        url: "https://perspikative.com/portfolio/creations",
        description:
          "Galerie principale des créations artistiques publiées sur Perspikative.",
        aliases: [
          "dessins",
          "œuvres",
          "oeuvres",
          "créations",
          "creations",
          "galerie",
          "portfolio"
        ]
      },

      illustrations: {
        title: "Illustrations",
        url: "https://perspikative.com/portfolio/illustrations",
        description:
          "Section consacrée aux illustrations de Perspikative.",
        aliases: [
          "illustrations",
          "illustration"
        ]
      },

      projets: {
        title: "Projets",
        url: "https://perspikative.com/portfolio/projets",
        description:
          "Section consacrée aux projets liés à Perspikative.",
        aliases: [
          "projets",
          "projects"
        ]
      }
    },

    facts: [
      "Le portfolio comprend au moins les sections Créations, Illustrations et Projets.",
      "Le nombre de créations est actuellement enregistré comme 44 dans cette base locale.",
      "Le compteur doit être révisé lorsqu'une nouvelle œuvre est publiée."
    ]
  },

  actus: {
    url: "https://perspikative.com/actus",

    facts: [
      {
        title: "Nouveautés de la recherche",
        date: "2026-04-01",
        type: "fonctionnalité",
        summary:
          "Recherche dynamique, nouvelles fonctionnalités et évolutions du site."
      },

      {
        title: "Perspikative Birthday",
        date: "2026-02-17",
        type: "évènement",
        summary:
          "Perspikative fête ses 2 ans avec une programmation comprenant notamment quiz, concours et dessin spécial."
      }
    ],

    description:
      "La page Actus rassemble les annonces et nouveautés de Perspikative."
  },

  artChallenge: {
    name: "ART Challenge",
    url: "https://perspikative.com/art-challenge",
    description:
      "Concours artistique organisé par Perspikative.",

    currentEdition: {
      year: 2026,
      number: 4,
      theme: "libre",
      constraints: "aucune",
      deadline: "2026-07-31T00:00:00+02:00",
      status: "clos",
      recurrence: "1 à 2 fois par an"
    },

    eligibility: {
      openToAll: true,

      description:
        "Le concours est présenté comme ouvert à tous, débutants comme artistes confirmés et amateurs créatifs.",

      styles:
        "Tous les styles et médiums sont les bienvenus."
    },

    acceptedMedia: [
      "dessin traditionnel",
      "dessin digital",
      "peinture",
      "collage",
      "graphisme",
      "autres formes d'expression visuelle compatibles avec les consignes"
    ],

    acceptedFiles: [
      "JPG",
      "JPEG",
      "PNG",
      "PDF",
      "WEBP",
      "GIF"
    ],

    imageRequirements: {
      minimumResolution: "1080 px",
      note:
        "La version détaillée de la page de consignes indique une résolution minimale de 1080 px."
    },

    submission: {
      requiredInfo: [
        "pseudo",
        "titre de l'œuvre"
      ],

      process: [
        "remplir le formulaire prévu par Perspikative",
        "transmettre l'œuvre selon les modalités indiquées",
        "Perspikative peut reprendre contact pour récupérer l'œuvre"
      ]
    },

    evaluation: {
      principles: [
        "respect du thème",
        "originalité",
        "créativité",
        "qualité"
      ],

      voting:
        "vote de la communauté",

      jury:
        "validation par un jury spécial mentionnée dans les consignes"
    },

    prizes: {
      ranking: [
        1,
        2,
        3
      ],

      nonFinancial: true,

      note:
        "Aucune récompense financière ne doit être présentée comme une récompense payante du concours.",

      first: [
        "mise en avant dans la galerie",
        "mise en avant sur les réseaux",
        "story dédiée",
        "badge spécial",
        "place réservée dans le Beta Program indiquée sur la page de récompenses",
        "proposition de collaboration",
        "récompense surprise variable"
      ],

      second: [
        "mise en avant dans la galerie",
        "mise en avant sur les réseaux",
        "story dédiée",
        "badge spécial",
        "récompense surprise variable"
      ],

      third: [
        "mise en avant dans la galerie",
        "mise en avant sur les réseaux",
        "certificat de participation"
      ],

      archives:
        "Les œuvres gagnantes sont affichées dans la galerie ART Challenge et conservées dans les archives de Perspikative."
    },

    rights: {
      publication:
        "La participation implique l'acceptation de la publication de l'œuvre sur le site et les réseaux Perspikative avec mention du pseudo.",

      ownership:
        "L'œuvre reste la propriété de l'artiste et Perspikative ne revendique pas la propriété de l'œuvre.",

      aiTraining:
        "Le projet de cet assistant ne nécessite pas l'utilisation des images du ART Challenge pour entraîner un modèle."
    }
  },

  community: {
    description:
      "Perspikative développe une communauté autour de l'art, des artistes, du partage et des échanges.",

    pages: [
      "Communauté",
      "Perspikateam",
      "Beta Program"
    ],

    facts: [
      "La communauté peut suivre les actualités et participer aux événements de Perspikative.",
      "Le ART Challenge s'appuie sur le vote de la communauté."
    ]
  },

  perspikateam: {
    name: "Perspikateam",

    description:
      "Équipe bénévole qui participe au développement, à la gestion et à l'animation de Perspikative.",

    facts: [
      "La Perspikateam contribue à la vie et à l'évolution du projet.",
      "Le fonctionnement de l'équipe est présenté comme bénévole."
    ]
  },

  betaProgram: {
    name: "Perspikative Beta Program",

    url:
      "https://beta.perspikative.com/",

    description:
      "Programme permettant de tester des fonctionnalités en avant-première.",

    facts: [
      "La version beta est distincte du site principal.",
      "Le Beta Program peut être mentionné parmi les avantages liés à certaines opérations de Perspikative."
    ]
  },

  features: {
    search: {
      name: "Recherche",

      url:
        "https://perspikative.com/rechercher",

      facts: [
        "Perspikative possède un système de recherche.",
        "La recherche est conçue pour être tolérante à certaines différences de saisie.",
        "La recherche est régulièrement susceptible d'évoluer avec les nouveautés du site."
      ]
    },

    profiles: {
      name: "Profils",

      facts: [
        "Perspikative prévoit des profils utilisateur.",
        "Les profils peuvent servir à présenter l'activité d'un membre."
      ]
    },

    comments: {
      name: "Commentaires",

      facts: [
        "Perspikative utilise un système de commentaires sur certaines parties du site.",
        "La modération et les limites d'utilisation font partie des mécanismes du site."
      ]
    }
  },

  technology: {
    firebase: {
      name: "Firebase",

      facts: [
        "Perspikative utilise Firebase pour certaines fonctions liées aux comptes et aux données utilisateurs."
      ]
    },

    githubPages: {
      name: "GitHub Pages",

      facts: [
        "Le site principal est hébergé via GitHub Pages."
      ]
    },

    analytics: {
      name: "Umami",

      facts: [
        "Perspikative utilise Umami pour l'analyse de fréquentation."
      ]
    }
  },

  programs: {
    grow: {
      name: "Perspikative Grow",

      description:
        "Programme orienté vers le développement et la visibilité des créateurs.",

      aliases: [
        "grow",
        "perspikative grow"
      ]
    }
  },

  legal: {
    ai: {
      title: "Position sur l'IA",

      url:
        "https://perspikative.com/position-ia",

      facts: [
        "Perspikative possède une page dédiée à sa position sur l'IA.",
        "Toute réponse de cet assistant doit éviter de présenter comme absolue une promesse éthique qui n'est pas documentée."
      ]
    },

    privacy: {
      title: "Politique de confidentialité",

      url:
        "https://perspikative.com/politique-confidentialite"
    },

    mentions: {
      title: "Mentions légales",

      url:
        "https://perspikative.com/mentions-legales"
    }
  },

  faq: [
    {
      q: "C'est quoi Perspikative ?",
      a:
        "Perspikative est un projet artistique personnel et un univers créatif qui rassemble des œuvres, des projets, des actualités et une communauté."
    },

    {
      q: "Où voir les créations ?",
      a:
        "Les créations sont accessibles dans la section Créations du portfolio."
    },

    {
      q: "Combien de créations sont enregistrées ?",
      a:
        "Cette version de la base enregistre actuellement 44 créations. Ce nombre doit être mis à jour lorsque le portfolio change."
    },

    {
      q: "C'est quoi le ART Challenge ?",
      a:
        "C'est le concours artistique de Perspikative."
    },

    {
      q: "Qui peut participer au ART Challenge ?",
      a:
        "Le concours est présenté comme ouvert à tous."
    },

    {
      q: "Quel est le rôle de la Perspikateam ?",
      a:
        "La Perspikateam contribue au développement, à la gestion et à l'animation de Perspikative."
    },

    {
      q: "C'est quoi le Beta Program ?",
      a:
        "C'est un programme de test de fonctionnalités en avant-première."
    }
  ]
};

if (typeof window !== "undefined") {
  window.PERSPIKATIVE_BASE = PERSPIKATIVE_BASE;
}

if (typeof module !== "undefined") {
  module.exports = PERSPIKATIVE_BASE;
}