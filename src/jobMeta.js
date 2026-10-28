const workModes = {
  remote: "Télétravail",
  hybrid: "Hybride",
  onsite: "Présentiel",
  on_site: "Présentiel",
};
export function workModeLabel(offer) {
  return Object.hasOwn(workModes, offer.workMode)
    ? workModes[offer.workMode]
    : null;
}
