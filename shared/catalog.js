export const domainGroups = {
  Informatique: [
    "Développement logiciel & web",
    "Data, IA & machine learning",
    "Cybersécurité",
    "Systèmes, réseaux & cloud",
    "Support & maintenance informatique",
    "Informatique embarquée & IoT",
    "Qualité logicielle & tests",
    "Autres métiers informatiques",
  ],
  Technique: [
    "Maintenance industrielle",
    "Électricité & électrotechnique",
    "Électronique & instrumentation",
    "Automatismes & robotique",
    "Mécanique & productique",
    "Énergie & environnement",
    "Bâtiment, génie civil & travaux publics",
    "Télécommunications",
    "Conception, méthodes & bureau d’études",
    "Aéronautique, spatial & naval",
    "Chimie, procédés & matériaux",
    "Qualité, sécurité & métrologie",
    "Autres métiers techniques",
  ],
  "Commerce & communication": [
    "Commerce & vente",
    "Marketing & communication",
    "Achats & relation client",
  ],
  "Gestion & services": [
    "Ressources humaines",
    "Comptabilité, finance & audit",
    "Banque, assurance & immobilier",
    "Droit & administration",
    "Assistanat & gestion",
    "Conseil & gestion de projet",
  ],
  "Santé & vie sociale": [
    "Santé & médico-social",
    "Social, éducation & animation",
    "Sport & bien-être",
    "Sécurité & services aux particuliers",
  ],
  "Mobilité & accueil": [
    "Transport & logistique",
    "Hôtellerie, restauration & tourisme",
    "Culture, arts & audiovisuel",
    "Journalisme & édition",
  ],
  "Production & vivant": [
    "Agriculture, paysage & environnement",
    "Artisanat, mode & métiers d’art",
    "Agroalimentaire & métiers de bouche",
  ],
  "Autres secteurs": ["Autres domaines"],
};
export const domains = Object.values(domainGroups).flat();
export const contracts = [
  "Stage",
  "Apprentissage",
  "Contrat de professionnalisation",
  "Alternance — type non précisé",
];
export const educationLevels = [
  "CAP / BEP",
  "Bac",
  "Bac + 2",
  "Bac + 3",
  "Bac + 4",
  "Bac + 5 et plus",
  "Sans niveau imposé",
];
export const groupOf = (domain) =>
  Object.keys(domainGroups).find((group) =>
    domainGroups[group].includes(domain),
  );
export const inScope = (offer) => domains.includes(offer.domain);
export const directory = [
  ...[
    [
      "sfeir",
      "SFEIR",
      "https://www.sfeir.com/",
      "Développement logiciel, cloud et data",
      "ESN",
      ["Dév Web/Cloud", "Data & IA"],
    ],
    [
      "zenika",
      "Zenika",
      "https://www.zenika.com/",
      "Ingénierie logicielle, cloud et accompagnement technique",
      "ESN",
      ["Dév Web/Cloud"],
    ],
    [
      "smile",
      "Smile",
      "https://www.smile.eu/",
      "Logiciels open source et ingénierie numérique",
      "ESN",
      ["Dév Web/Cloud", "Systèmes & Infrastructure"],
    ],
    [
      "niji",
      "Niji",
      "https://www.niji.fr/",
      "Services et ingénierie numérique",
      "ESN",
      ["Dév Web/Cloud"],
    ],
    [
      "apside",
      "Apside",
      "https://www.apside.com/",
      "Ingénierie, systèmes et informatique",
      "ESN",
      ["Systèmes embarqués", "Dév Web/Cloud"],
    ],
    [
      "clevercloud",
      "Clever Cloud",
      "https://www.clever-cloud.com/",
      "Plateforme cloud pour les développeurs",
      "Hébergeur cloud",
      ["Dév Web/Cloud", "Systèmes & Infrastructure"],
    ],
    [
      "sewan",
      "Sewan",
      "https://www.sewan.fr/",
      "Télécommunications et services cloud",
      "Opérateur télécoms",
      ["Réseaux & Télécoms", "Systèmes & Infrastructure"],
    ],
    [
      "wifirst",
      "Wifirst",
      "https://www.wifirst.com/",
      "Réseaux Wi-Fi et connectivité professionnelle",
      "Opérateur télécoms",
      ["Réseaux & Télécoms"],
    ],
    [
      "celeste",
      "CELESTE",
      "https://www.celeste.fr/",
      "Connectivité et télécommunications pour les entreprises",
      "Opérateur télécoms",
      ["Réseaux & Télécoms"],
    ],
    [
      "synacktiv",
      "Synacktiv",
      "https://www.synacktiv.com/",
      "Expertise en sécurité informatique",
      "Entreprise",
      ["Cybersécurité"],
    ],
    [
      "quarkslab",
      "Quarkslab",
      "https://www.quarkslab.com/",
      "Recherche et expertise en cybersécurité",
      "Entreprise",
      ["Cybersécurité"],
    ],
    [
      "koesio",
      "Koesio",
      "https://www.koesio.com/",
      "Services numériques et infrastructures pour les organisations",
      "Entreprise",
      ["Systèmes & Infrastructure", "Réseaux & Télécoms"],
    ],
  ].map(([id, name, website, focus, type, tags]) => ({
    id,
    name,
    website,
    focus,
    type,
    tags,
    searchDomain: new URL(website).hostname.replace(/^www\./, ""),
  })),

  {
    id: "thales",
    name: "Thales",
    website: "https://www.thalesgroup.com/",
    focus: "Électronique, systèmes embarqués, cybersécurité",
    searchDomain: "thalesgroup.com",
  },
  {
    id: "schneider",
    name: "Schneider Electric",
    website: "https://www.se.com/",
    focus: "Électrotechnique, automatismes, énergie, numérique",
    searchDomain: "se.com",
  },
  {
    id: "safran",
    name: "Safran",
    website: "https://www.safran-group.com/",
    focus: "Aéronautique, mécanique, électronique, logiciel",
    searchDomain: "safran-group.com",
  },
  {
    id: "capgemini",
    name: "Capgemini",
    website: "https://www.capgemini.com/",
    focus: "Développement, data, cloud, ingénierie",
    searchDomain: "capgemini.com",
  },
  {
    id: "airbus",
    name: "Airbus",
    website: "https://www.airbus.com/",
    focus: "Aéronautique, production, systèmes, informatique",
    searchDomain: "airbus.com",
  },
  {
    id: "vinci",
    name: "VINCI",
    website: "https://www.vinci.com/",
    focus: "Génie civil, énergie, réseaux et infrastructures",
    searchDomain: "vinci.com",
  },
  {
    id: "edf",
    name: "EDF",
    website: "https://www.edf.fr/",
    focus: "Énergie, maintenance, ingénierie, informatique",
    searchDomain: "edf.fr",
  },
];
export function googleSearch(company, query = "") {
  return (
    "https://www.google.com/search?q=" +
    encodeURIComponent(
      `site:${company.searchDomain} (stage OR alternance OR apprentissage) ${query} France`,
    )
  );
}
