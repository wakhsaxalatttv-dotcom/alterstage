import { inScope, groupOf } from "../shared/catalog.js";
export const regions = {
  "Auvergne-Rhône-Alpes": "01 03 07 15 26 38 42 43 63 69 73 74",
  "Bourgogne-Franche-Comté": "21 25 39 58 70 71 89 90",
  Bretagne: "22 29 35 56",
  "Centre-Val de Loire": "18 28 36 37 41 45",
  Corse: "2A 2B",
  "Grand Est": "08 10 51 52 54 55 57 67 68 88",
  "Hauts-de-France": "02 59 60 62 80",
  "Île-de-France": "75 77 78 91 92 93 94 95",
  Normandie: "14 27 50 61 76",
  "Nouvelle-Aquitaine": "16 17 19 23 24 33 40 47 64 79 86 87",
  Occitanie: "09 11 12 30 31 32 34 46 48 65 66 81 82",
  "Pays de la Loire": "44 49 53 72 85",
  "Provence-Alpes-Côte d’Azur": "04 05 06 13 83 84",
  Guadeloupe: "971",
  Martinique: "972",
  Guyane: "973",
  "La Réunion": "974",
  Mayotte: "976",
};
export function regionOf(offer) {
  if (offer.location.region) return offer.location.region;
  const code = offer.location.commune || "";
  const dep = code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2);
  return (
    Object.keys(regions).find((r) => regions[r].split(" ").includes(dep)) || ""
  );
}
export const defaultFilters = {
  query: "",
  region: "",
  domain: "",
  education: "",
  contract: "",
  age: "",
  group: "",
};
export function selectOffers(offers, filters, now = Date.now()) {
  const text = (s) =>
    (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return offers
    .filter(inScope)
    .filter((o) => !["expired", "withdrawn"].includes(o.status))
    .filter((o) => !o.expiresAt || Date.parse(o.expiresAt) + 86400000 > now)
    .filter(
      (o) =>
        !filters.query ||
        text(
          [o.title, o.company.name, o.domain, o.location.label].join(" "),
        ).includes(text(filters.query)),
    )
    .filter((o) => !filters.region || regionOf(o) === filters.region)
    .filter((o) => !filters.group || groupOf(o.domain) === filters.group)
    .filter((o) => !filters.domain || o.domain === filters.domain)
    .filter(
      (o) => !filters.education || o.education.includes(filters.education),
    )
    .filter((o) => !filters.contract || o.contract === filters.contract)
    .filter(
      (o) =>
        !filters.age ||
        (o.publishedAt &&
          now - Date.parse(o.publishedAt) <= Number(filters.age) * 86400000 &&
          Date.parse(o.publishedAt) <= now),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
    );
}
export function freshness(o) {
  if (o.status === "expired") return "Offre expirée";
  if (o.status === "withdrawn") return "Offre retirée";
  if (o.publishedAt && Date.now() - Date.parse(o.publishedAt) > 30 * 86400000)
    return "Offre ancienne";
  if (
    !o.lastVerifiedAt ||
    Number.isNaN(Date.parse(o.lastVerifiedAt)) ||
    Date.now() - Date.parse(o.lastVerifiedAt) > 7 * 86400000 ||
    o.status === "to_verify"
  )
    return "À vérifier";
  return (
    "Vérifiée le " + new Date(o.lastVerifiedAt).toLocaleDateString("fr-FR")
  );
}
