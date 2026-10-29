const blockedName = (value) =>
  typeof value === "string" &&
  /\bmeteo[\s_-]*job\b/i.test(
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
export function isMeteojobUrl(value, depth = 0) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      host === "meteojob.com" ||
      host.endsWith(".meteojob.com") ||
      host === "meteojob.fr" ||
      host.endsWith(".meteojob.fr")
    )
      return true;
    if (depth < 2) {
      for (const key of [
        "url",
        "u",
        "q",
        "target",
        "redirect",
        "redirect_url",
        "destination",
      ]) {
        const target = url.searchParams.get(key);
        if (target && isMeteojobUrl(target, depth + 1)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
// Check structured provenance, not a passing mention in an employer's description.
export function isBlockedSource(offer = {}) {
  if (!offer || typeof offer !== "object") return false;
  return (
    [
      offer.sourcePartner,
      offer.sourceName,
      offer.sourceId,
      offer.source,
      offer.via,
    ].some(blockedName) ||
    [
      offer.sourceUrl,
      offer.applicationUrl,
      offer.source_link,
      offer.share_link,
    ].some((value) => isMeteojobUrl(value)) ||
    (Array.isArray(offer.apply_options) &&
      offer.apply_options.some(
        (o) => blockedName(o?.title) || isMeteojobUrl(o?.link),
      ))
  );
}
