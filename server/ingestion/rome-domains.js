import reference from "../../config/france-travail-rome.json" with { type: "json" };
const families = {
  A: "Agriculture, paysage & environnement",
  B: "Artisanat, mode & métiers d’art",
  C: "Banque, assurance & immobilier",
  D: "Commerce & vente",
  E: "Marketing & communication",
  F: "Bâtiment, génie civil & travaux publics",
  G: "Hôtellerie, restauration & tourisme",
  H: "Autres métiers techniques",
  I: "Maintenance industrielle",
  J: "Santé & médico-social",
  K: "Social, éducation & animation",
  L: "Culture, arts & audiovisuel",
  M: "Assistanat & gestion",
  N: "Transport & logistique",
};
export function broadRomeDomain(code) {
  if (/^M11/.test(code)) return "Achats & relation client";
  if (/^M12/.test(code)) return "Comptabilité, finance & audit";
  if (/^M13|^M1402/.test(code)) return "Conseil & gestion de projet";
  if (/^M14|^M17/.test(code)) return "Marketing & communication";
  if (/^M15/.test(code)) return "Ressources humaines";
  if (/^M18/.test(code)) return "Autres métiers informatiques";
  if (/^K19|^K14/.test(code)) return "Droit & administration";
  if (/^K17|^K25|^K22/.test(code))
    return "Sécurité & services aux particuliers";
  if (/^K11|^L14/.test(code)) return "Sport & bien-être";
  if (/^D11|^H21/.test(code)) return "Agroalimentaire & métiers de bouche";
  if (/^E110[2-6]/.test(code)) return "Journalisme & édition";
  return families[code?.[0]] || "Autres domaines";
}
export const allRomeDomains = Object.fromEntries(
  reference.metiers.map(({ code, parent }) => [
    code,
    broadRomeDomain(parent || code),
  ]),
);

export const romeParents = Object.fromEntries(
  reference.metiers.map(({ code, parent }) => [code, parent]),
);
