import {hasOwnerConfirmedCreditAgricoleListing} from './credit-agricole-owner-confirmation.js';
import {hasOwnerConfirmedRteListing} from './rte-owner-confirmation.js';
import {hasOwnerConfirmedSncfListing} from './sncf-owner-confirmation.js';
import {hasOwnerConfirmedToyotaListing} from './toyota-owner-confirmation.js';
// Each employer has its own fixed record/hash/URL allowlist; no general date waiver.
export function hasOwnerConfirmedListing(offer, now = Date.now()) {
  return hasOwnerConfirmedCreditAgricoleListing(offer, now) || hasOwnerConfirmedRteListing(offer, now) || hasOwnerConfirmedSncfListing(offer, now) || hasOwnerConfirmedToyotaListing(offer, now);
}
