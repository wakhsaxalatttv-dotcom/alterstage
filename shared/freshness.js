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
