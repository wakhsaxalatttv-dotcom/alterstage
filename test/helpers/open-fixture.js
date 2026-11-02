// Synthetic availability evidence for isolated test databases only. Never imported by runtime code.
import { auditAvailability } from '../../server/ingestion/availability.js';
export const fixtureOpenEvidence = (offer, now = Date.now()) => ({
  kind: 'application-page', checkedAt: new Date(now).toISOString(),
  url: offer.applicationUrl || offer.sourceUrl,
  validThrough: new Date(now + 7 * 86400000).toISOString(),
  jobIdentityMatched: true, applicationActionFound: true,
});
export async function confirmFixtureApplications(store, now = Date.now()) {
  return auditAvailability(store, { now, check: async (_url, offer) => ({ state: 'open', evidence: fixtureOpenEvidence(offer, now) }) });
}
