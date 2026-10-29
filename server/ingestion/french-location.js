import { dispatcher } from "./http.js";
import { plainText, searchText } from "../enrichment.js";
const regionCodes = {
  84: "Auvergne-Rhône-Alpes",
  27: "Bourgogne-Franche-Comté",
  53: "Bretagne",
  24: "Centre-Val de Loire",
  94: "Corse",
  44: "Grand Est",
  32: "Hauts-de-France",
  11: "Île-de-France",
  28: "Normandie",
  75: "Nouvelle-Aquitaine",
  76: "Occitanie",
  52: "Pays de la Loire",
  93: "Provence-Alpes-Côte d’Azur",
  "01": "Guadeloupe",
  "02": "Martinique",
  "03": "Guyane",
  "04": "La Réunion",
  "06": "Mayotte",
};
export function createFrenchLocationResolver({
  fetcher = fetch,
  now = Date.now,
} = {}) {
  const cache = new Map();
  return async function resolveLocation(value) {
    const raw = plainText(value, 200);
    // Search geolocation alone is not evidence that the offered position is in France.
    if (!/\bfrance\b/i.test(raw)) return null;
    const name = raw
      .split(",")[0]
      .trim()
      .replace(/\s*\(\d{2,5}\)\s*$/, "")
      .replace(/^\d{5}\s+/, "");
    if (name.length < 2 || /remote|télétravail|partout/i.test(name))
      return null;
    const key = searchText(name),
      previous = cache.get(key);
    if (previous && previous.until > now()) return previous.value;
    const url = new URL("https://geo.api.gouv.fr/communes");
    url.search = new URLSearchParams({
      nom: name,
      fields: "nom,code,codeRegion",
      limit: "20",
      format: "json",
    });
    let location = null;
    try {
      const response = await fetcher(url.href, {
        dispatcher,
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (
        !response.ok ||
        !/json/i.test(response.headers.get("content-type") || "")
      ) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256 * 1024) throw new Error("size");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const matches = Array.isArray(data)
        ? data.filter(
            (c) =>
              searchText(c.nom || "") === key &&
              regionCodes[c.codeRegion] &&
              /^[0-9A-Z]{5}$/.test(c.code || ""),
          )
        : [];
      if (matches.length === 1)
        location = {
          label: raw,
          city: matches[0].nom,
          region: regionCodes[matches[0].codeRegion],
          commune: matches[0].code,
          provenance:
            "https://geo.api.gouv.fr/decoupage-administratif/communes",
        };
    } catch {
      return null;
    }
    if (cache.size >= 1000) cache.delete(cache.keys().next().value);
    cache.set(key, {
      value: location,
      until: now() + (location ? 86400000 : 3600000),
    });
    return location;
  };
}
