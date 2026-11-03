import {hasOwnerConfirmedSncfListing} from './sncf-owner-confirmation.js';
import {hasOwnerConfirmedToyotaListing} from './toyota-owner-confirmation.js';
// Each employer has its own fixed record/hash/URL allowlist; no general date waiver.
export function hasOwnerConfirmedListing(offer, now = Date.now()) {
  return hasOwnerConfirmedSncfListing(offer, now) || hasOwnerConfirmedToyotaListing(offer, now);
}
