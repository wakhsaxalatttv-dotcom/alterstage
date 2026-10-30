import reference from "../../config/france-travail-rome.json" with { type: "json" };
import { romeDomains } from "./lba.js";
// Keep established specializations while covering every official ROME family.
const parentDomains = {
  ...romeDomains,
  M1804: "Télécommunications",
  M1806: "Autres métiers informatiques",
  M1807: "Télécommunications",
  F1605: "Électricité & électrotechnique",
  M1808: "Conception, méthodes & bureau d’études",
  M1809: "Énergie & environnement",
  H1203: "Mécanique & productique",
  H1207: "Conception, méthodes & bureau d’études",
  H1401: "Conception, méthodes & bureau d’études",
  H1501: "Chimie, procédés & matériaux",
  H1502: "Qualité, sécurité & métrologie",
  H1505: "Chimie, procédés & matériaux",
  H2501: "Électronique & instrumentation",
  H2502: "Conception, méthodes & bureau d’études",
  H2503: "Autres métiers techniques",
  H2504: "Autres métiers techniques",
  H2701: "Énergie & environnement",
  H2702: "Énergie & environnement",
  H2901: "Mécanique & productique",
  H2902: "Mécanique & productique",
  H2903: "Mécanique & productique",
  H2909: "Mécanique & productique",
  H2912: "Mécanique & productique",
  H2913: "Mécanique & productique",
  I1101: "Maintenance industrielle",
  I1102: "Maintenance industrielle",
  I1301: "Maintenance industrielle",
  I1303: "Maintenance industrielle",
  I1305: "Électronique & instrumentation",
  I1306: "Énergie & environnement",
  I1602: "Aéronautique, spatial & naval",
  I1603: "Mécanique & productique",
  F1103: "Bâtiment, génie civil & travaux publics",
  F1104: "Bâtiment, génie civil & travaux publics",
  F1105: "Énergie & environnement",
  F1106: "Bâtiment, génie civil & travaux publics",
  F1107: "Bâtiment, génie civil & travaux publics",
  F1201: "Bâtiment, génie civil & travaux publics",
  F1202: "Bâtiment, génie civil & travaux publics",
  F1602: "Électricité & électrotechnique",
  F1603: "Énergie & environnement",
  K2301: "Énergie & environnement",
  K2302: "Énergie & environnement",
  K2306: "Énergie & environnement",
};

export const franceTravailDomains = Object.fromEntries(
  reference.metiers
    .filter(({ code, parent }) => parentDomains[code] || parentDomains[parent])
    .map(({ code, parent }) => [
      code,
      parentDomains[parent] || parentDomains[code],
    ]),
);
