// An import timestamp or a provider's "active" status is not availability proof.
export const OPEN_PROOF_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export function hasRecentOpenEvidence(offer, now = Date.now()) {
  const evidence = offer?.availabilityEvidence;
  if (!evidence || !["application-page", "manual-review"].includes(evidence.kind)) return false;
  const checked = Date.parse(evidence.checkedAt);
  if (!Number.isFinite(checked) || checked > now || now - checked >= OPEN_PROOF_MAX_AGE_MS) return false;
  if (!evidence.url || evidence.url !== (offer.applicationUrl || offer.sourceUrl)) return false;
  if (evidence.kind === "manual-review") return evidence.openConfirmed === true;
  const end = Date.parse(evidence.validThrough);
  return evidence.jobIdentityMatched === true && evidence.applicationActionFound === true && Number.isFinite(end) && end > now;
}
