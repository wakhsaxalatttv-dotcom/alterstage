import { domains } from "./catalog.js";
const terms = {
  "Développement logiciel & web": "développement logiciel web",
  "Data, IA & machine learning": "data intelligence artificielle",
  Cybersécurité: "cybersécurité",
  "Systèmes, réseaux & cloud": "systèmes réseaux cloud",
  "Support & maintenance informatique": "support maintenance informatique",
  "Informatique embarquée & IoT": "informatique embarquée IoT",
  "Qualité logicielle & tests": "tests qualité logicielle",
  "Autres métiers informatiques": "informatique",
  "Maintenance industrielle": "maintenance industrielle",
  "Électricité & électrotechnique": "électricité électrotechnique",
  "Électronique & instrumentation": "électronique instrumentation",
  "Automatismes & robotique": "automatismes robotique",
  "Mécanique & productique": "mécanique productique",
  "Énergie & environnement": "énergie environnement",
  "Bâtiment, génie civil & travaux publics":
    "bâtiment génie civil travaux publics",
  Télécommunications: "télécommunications",
  "Conception, méthodes & bureau d’études": "conception méthodes bureau études",
  "Aéronautique, spatial & naval": "aéronautique spatial naval",
  "Chimie, procédés & matériaux": "chimie procédés matériaux",
  "Qualité, sécurité & métrologie": "qualité sécurité métrologie",
  "Autres métiers techniques": "technique industriel",
};
export const SERPAPI_SEARCHES = domains.flatMap((domain) =>
  ["stage", "alternance"].map((contract) => ({
    id: `${contract}:${domain}`,
    domain,
    contract,
    query: `${contract} ${terms[domain] || domain}`,
  })),
);
