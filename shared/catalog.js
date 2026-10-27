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
};
export const domains = Object.values(domainGroups).flat();
export const contracts = [
  "Stage",
  "Apprentissage",
  "Contrat de professionnalisation",
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
