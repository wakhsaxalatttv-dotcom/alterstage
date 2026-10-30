import { readFileSync } from "node:fs";
// User-reported unreliable import batch. Suspension is not proof that every
// vacancy is closed; these URLs must be independently rechecked before reuse.
const snapshot = JSON.parse(readFileSync(new URL("../config/market-offers.json", import.meta.url), "utf8"));
const key = (value) => {
  try {
    const u = new URL(value);
    u.hash = "";
    for (const name of [...u.searchParams.keys()])
      if (/^(utm_|source$|s_o$)/i.test(name)) u.searchParams.delete(name);
    u.searchParams.sort();
    return u.href.replace(/\/$/, "");
  } catch { return null; }
};
const urls = new Set(snapshot.publicationSuspended ? snapshot.offers.flatMap((o) => [key(o.sourceUrl), key(o.applicationUrl)]).filter(Boolean) : []);
export const isSuspendedImport = (offer) => [offer.sourceUrl, offer.applicationUrl].some((url) => urls.has(key(url)));
