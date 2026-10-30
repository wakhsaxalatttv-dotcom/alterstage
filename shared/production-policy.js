// Inspect provenance and explicit test markers, not a legitimate software testing role.
export function isNonProductionUrl(value) {
  try {
    const u = new URL(value),
      host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      /^127\.|^10\.|^192\.168\./.test(host) ||
      /(?:^|[.-])(?:recette|sandbox|staging|preprod|preproduction|ppd|rec|demo)(?:[.-]|$)/i.test(
        host,
      )
    );
  } catch {
    return false;
  }
}
export function isNonProductionOffer(offer = {}) {
  if (!offer || typeof offer !== "object") return false;
  const title = String(offer.title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    [offer.sourceUrl, offer.applicationUrl, offer.source_link].some(
      isNonProductionUrl,
    ) ||
    (Array.isArray(offer.apply_options) &&
      offer.apply_options.some((o) => isNonProductionUrl(o?.link))) ||
    /\b(?:annonce|offre)\s+(?:de\s+)?(?:test|fictive?s?|demonstration)\b|\btitre\s+(?:personnalise\s+)?test\b|\(recette\b|\bturlututu\b/i.test(
      title,
    )
  );
}
