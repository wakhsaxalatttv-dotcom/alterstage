export const MAX_PUBLICATION_AGE_DAYS = 45;
const DAY = 86400000;
// La limite est inclusive et calculée par jour pour les dates source sans heure.
export const publicationCutoff = (now = Date.now()) =>
  new Date(now - MAX_PUBLICATION_AGE_DAYS * DAY).toISOString().slice(0, 10);
export function isRecentPublication(value, now = Date.now()) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return false;
  const date = value.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    return false;
  return (
    Date.parse(value) >= Date.parse(publicationCutoff(now)) &&
    Date.parse(value) <= now
  );
}

// A relative source label is an interval, never an exact publication date.
export function relativePublicationWindow(text, observedAt) {
  if (typeof text !== "string" || text.length > 160) return null;
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return null;
  const value = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase();
  const match = value.match(
    /^(?:(?:posted\s+)?(?:il y a\s+)?)?(\d{1,3})\s*(minutes?|mins?|heures?|hours?|jours?|days?|semaines?|weeks?|mois|months?)(?:\s+ago)?$/,
  );
  if (!match) return null;
  const amount = Number(match[1]),
    unit = match[2];
  let earliest, latest;
  if (/mois|month/.test(unit)) {
    earliest = observed - 31 * (amount + 1) * DAY;
    latest = observed - Math.max(0, 28 * (amount - 1)) * DAY;
  } else {
    const duration = /minute|min/.test(unit)
      ? 60000
      : /heure|hour/.test(unit)
        ? 3600000
        : /semaine|week/.test(unit)
          ? 7 * DAY
          : DAY;
    earliest = observed - (amount + 1) * duration;
    latest = observed - Math.max(0, amount - 1) * duration;
  }
  return {
    earliest: new Date(earliest).toISOString(),
    latest: new Date(latest).toISOString(),
    observedAt: new Date(observed).toISOString(),
  };
}
export function publicationIndex(offer) {
  if (offer.sourcePublishedAt || offer.publishedAt)
    return offer.sourcePublishedAt || offer.publishedAt;
  if (
    offer.sourceId !== "serpapi-google-jobs" ||
    offer.publicationEvidence?.kind !== "relative"
  )
    return null;
  return (
    relativePublicationWindow(
      offer.publicationEvidence.text,
      offer.publicationEvidence.observedAt,
    )?.earliest || null
  );
}
export function hasRecentPublication(offer, now = Date.now()) {
  if (offer.sourcePublishedAt || offer.publishedAt)
    return isRecentPublication(
      offer.sourcePublishedAt || offer.publishedAt,
      now,
    );
  if (
    offer.sourceId !== "serpapi-google-jobs" ||
    offer.publicationEvidence?.kind !== "relative"
  )
    return false;
  const window = relativePublicationWindow(
    offer.publicationEvidence.text,
    offer.publicationEvidence.observedAt,
  );
  return Boolean(
    window &&
      Date.parse(window.observedAt) <= now &&
      Date.parse(window.latest) <= now &&
      isRecentPublication(window.earliest, now),
  );
}
