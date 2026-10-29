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
const locationKey = (value) =>
  searchText(value).replace(/[-'’]/g, " ").replace(/\s+/g, " ").trim();
export function createFrenchLocationResolver({
  fetcher = fetch,
  now = Date.now,
} = {}) {
  const cache = new Map();
  const regionAliases = Object.entries(regionCodes).map(([code, name]) => ({
    code,
    name,
    key: locationKey(name),
  }));
  async function inspect(value, { countryContext } = {}) {
    const raw = plainText(value, 200);
    const segments = raw.split(",").map((v) => v.trim());
    const suppliedRegion = regionAliases.find((r) =>
      segments.slice(1).some((part) => locationKey(part) === r.key),
    );
    const postal = raw.match(/\b\d{5}\b/)?.[0];
    const explicitFrance =
      /\bfrance\b/i.test(raw) ||
      segments.slice(1).some((part) => /^FR$/i.test(part));
    if (
      !explicitFrance &&
      !suppliedRegion &&
      !postal &&
      countryContext !== "FR"
    )
      return { location: null, reason: "location_country_or_region_missing" };
    // A country-qualified location must not be redirected to its French namesake.
    if (
      /\b(?:USA|United States|Texas|Canada|Belgique|Belgium|Suisse|Switzerland|Germany|Allemagne|UK|United Kingdom)\b/i.test(
        raw,
      )
    )
      return { location: null, reason: "foreign_location" };
    const name = (segments[0] || "")
      .replace(/\b\d{5}\b/g, "")
      .trim()
      .replace(/\s*\(\d{2,3}\)\s*$/, "");
    if (name.length < 2 || /remote|télétravail|partout/i.test(name))
      return { location: null, reason: "location_city_missing" };
    const normalizedName = locationKey(name);
    const key = [
      normalizedName,
      suppliedRegion?.code || "",
      postal || "",
      explicitFrance ? "explicit" : countryContext || "",
    ].join("|");
    const cached = cache.get(key);
    if (cached && cached.until > now()) return cached.result;
    const url = new URL("https://geo.api.gouv.fr/communes");
    url.search = new URLSearchParams({
      nom: name,
      fields: "nom,code,codeRegion,codesPostaux",
      limit: "100",
      format: "json",
    });
    let result;
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
        return {
          location: null,
          reason: response.ok
            ? "geocoding_invalid_response"
            : `geocoding_http_${response.status}`,
        };
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
              locationKey(c.nom || "") === normalizedName &&
              regionCodes[c.codeRegion] &&
              /^[0-9A-Z]{5}$/.test(c.code || "") &&
              (!suppliedRegion ||
                String(c.codeRegion) === suppliedRegion.code) &&
              (!postal ||
                (Array.isArray(c.codesPostaux) &&
                  c.codesPostaux.includes(postal))),
          )
        : [];
      result =
        matches.length === 1
          ? {
              location: {
                label: raw,
                city: matches[0].nom,
                region: regionCodes[matches[0].codeRegion],
                commune: matches[0].code,
                provenance:
                  "https://geo.api.gouv.fr/decoupage-administratif/communes",
                countryBasis: explicitFrance
                  ? "source-country"
                  : suppliedRegion
                    ? "source-region-and-official-commune"
                    : postal
                      ? "source-postcode-and-official-commune"
                      : "france-search-and-unique-official-commune",
              },
              reason: null,
            }
          : {
              location: null,
              reason:
                matches.length > 1
                  ? "location_ambiguous"
                  : "location_no_exact_match",
            };
    } catch {
      return { location: null, reason: "geocoding_unavailable" };
    }
    if (cache.size >= 1000) cache.delete(cache.keys().next().value);
    cache.set(key, {
      result,
      until: now() + (result.location ? 86400000 : 3600000),
    });
    return result;
  }
  const resolve = async (value, context) =>
    (await inspect(value, context)).location;
  resolve.inspect = inspect;
  return resolve;
}
