import { lookup } from "node:dns/promises";
import { dispatcher, publicAddress } from "./http.js";
import { safeUrl } from "../domain.js";

// Only explicit closure evidence counts. Blocks, CAPTCHAs and network failures
// are inconclusive; a successful HTTP response alone never verifies a vacancy.
export function closureEvidence(status, html = "") {
  if (status === 404 || status === 410) return `HTTP ${status}`;
  if (status !== 200) return null;
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&rsquo;|&#8217;|&#39;/g, "\'")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'").replace(/\s+/g, " ");
  const match = text.match(/(?:^\s*|[.!?]\s+|\bcette\s+)(?:offre|annonce|opportunite)\s+(?:d'emploi\s+)?(?:a ete pourvue|est pourvue|est cloturee|a ete cloturee|a expire|est expiree|n'est plus disponible|n'est plus en ligne|n'est plus accessible|n'existe plus)|\b(?:this (?:job|position|vacancy|opportunity) (?:is no longer available|has expired|has been filled|is closed))\b/i);
  return match?.[0] || null;
}
export async function checkApplicationPage(value) {
  try {
    let url = safeUrl(value);
    for (let hop = 0; hop < 4; hop++) {
      if (!url) return { state: "unknown" };
      const addresses = await lookup(new URL(url).hostname, { all: true });
      if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
        return { state: "unknown" };
      const response = await fetch(url, {
        dispatcher, redirect: "manual", signal: AbortSignal.timeout(8000),
        headers: { Accept: "text/html", "User-Agent": "OffresFraiches/1.0 availability-check" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        url = location ? safeUrl(new URL(location, url).href) : null;
        continue;
      }
      let html = "";
      if (response.status === 200 && /html/i.test(response.headers.get("content-type") || "")) {
        const reader = response.body.getReader();
        let bytes = 0;
        const chunks = [];
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 1024 * 1024) return { state: "unknown" };
            chunks.push(value);
          }
          html = Buffer.concat(chunks).toString("utf8");
        } finally { await reader.cancel().catch(() => {}); }
      } else await response.body?.cancel();
      const evidence = closureEvidence(response.status, html);
      return evidence ? { state: "closed", evidence } : { state: "unknown" };
    }
  } catch { /* Never persist raw errors, response bodies or URL credentials. */ }
  return { state: "unknown" };
}
export async function auditAvailability(store, { check = checkApplicationPage, now = Date.now(), limit = 200 } = {}) {
  const rows = store.db.prepare("SELECT id,payload FROM offers WHERE moderation='approved' AND status NOT IN ('expired','withdrawn')").all()
    .filter((row) => {
      const o = JSON.parse(row.payload);
      return !o.availabilityCheckedAt || now - Date.parse(o.availabilityCheckedAt) >= 6 * 3600000;
    }).sort((a, b) => (JSON.parse(a.payload).availabilityCheckedAt || "").localeCompare(JSON.parse(b.payload).availabilityCheckedAt || "")).slice(0, limit);
  let cursor = 0, closed = 0, inconclusive = 0;
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++], candidate = JSON.parse(row.payload);
      const result = await check(candidate.applicationUrl || candidate.sourceUrl);
      if (result.state !== "closed") inconclusive++;
      store.transaction(() => {
        const latest = store.db.prepare("SELECT payload FROM offers WHERE id=?").get(row.id);
        if (!latest) return;
        const offer = JSON.parse(latest.payload);
        if (offer.applicationUrl !== candidate.applicationUrl || offer.sourceUrl !== candidate.sourceUrl) return;
        offer.availabilityCheckedAt = new Date(now).toISOString();
        if (result.state === "closed") {
          offer.sourceClosedAt = new Date(now).toISOString();
          offer.status = "withdrawn";
          offer.moderationStatus = "withdrawn";
          offer.reviewNote = "Page de candidature clôturée : " + result.evidence;
          closed++;
        }
        store.db.prepare("UPDATE offers SET payload=?,status=?,moderation=? WHERE id=?")
          .run(JSON.stringify(offer), offer.status, offer.moderationStatus, offer.id);
      });
    }
  }));
  return { checked: rows.length, closed, inconclusive };
}
