export const companyTypes = [
  "PME",
  "ESN",
  "Start-up",
  "Sous-traitant",
  "Opérateur télécoms",
  "Hébergeur cloud",
  "Entreprise",
];
export const companySizes = [
  "1–9 salariés",
  "10–49 salariés",
  "50–249 salariés",
  "250–999 salariés",
  "1 000 salariés et plus",
];
export const companyTags = [
  "Réseaux & Télécoms",
  "Cybersécurité",
  "Systèmes embarqués",
  "Dév Web/Cloud",
  "Systèmes & Infrastructure",
  "Data & IA",
  "Industrie & Maintenance",
  "Énergie & Électricité",
  "Ingénierie & Bureau d’études",
];

export const hostingFilters = [
  { value: "reviewed", label: "Accueil contrôlé" },
  { value: "offers", label: "Offres récentes au catalogue" },
  { value: "unconfirmed", label: "Accueil à confirmer" },
];
export const HOSTING_REVIEW_DAYS = 90;
export function isHostingReviewCurrent(review, now = Date.now()) {
  if (
    !review ||
    review.identityChecked !== true ||
    review.conditionsChecked !== true ||
    review.sourceChecked !== true ||
    !review.acceptedContracts?.length
  )
    return false;
  const elapsed = now - Date.parse(review.reviewedAt);
  try {
    const url = new URL(review.sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
  } catch {
    return false;
  }
  return (
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    elapsed < HOSTING_REVIEW_DAYS * 86400000
  );
}
