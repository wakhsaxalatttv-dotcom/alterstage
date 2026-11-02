import { hasRecentOpenEvidence } from "../../shared/availability.js";
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
  const explicitPosition = text.match(/\b(?:ce|le) poste (?:est (?:deja )?pourvu|a ete pourvu)|\b(?:nous n'acceptons plus de candidatures|candidatures? (?:sont )?cloturees?)\b/i);
  if (explicitPosition) return explicitPosition[0];
  const match = text.match(/(?:^\s*|[.!?]\s+|\bcette\s+)(?:offre|annonce|opportunite)\s+(?:d'emploi\s+)?(?:a ete pourvue|est pourvue|est cloturee|a ete cloturee|a expire|est expiree|n'est plus disponible|n'est plus en ligne|n'est plus accessible|n'existe plus)|\b(?:this (?:job|position|vacancy|opportunity) (?:is no longer available|has expired|has been filled|is closed))\b/i);
  return match?.[0] || null;
}

const identityText = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Positive proof needs a matching individual JobPosting, a future closing
// deadline and an enabled application control. Generic careers pages fail.
export function openApplicationEvidence(html, offer, now = Date.now()) {
  if (!offer?.title || !offer?.company?.name || closureEvidence(200, html)) return null;
  const nodes = [];
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 6 || nodes.length > 100) return;
    if (Array.isArray(node)) return node.slice(0, 100).forEach((n) => visit(n, depth + 1));
    if ([].concat(node["@type"] || []).some((t) => /^(?:https?:\/\/schema.org\/)?JobPosting$/.test(t))) nodes.push(node);
    if (node["@graph"]) visit(node["@graph"], depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1])); } catch { /* Invalid metadata is inconclusive. */ }
  }
  const job = nodes.find((node) => identityText(node.title) === identityText(offer.title) && identityText(node.hiringOrganization?.name) === identityText(offer.company.name));
  if (!job || !Number.isFinite(Date.parse(job.validThrough)) || Date.parse(job.validThrough) <= now) return null;
  const visible = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const controls = [...visible.matchAll(/<(a|button|input)\b([^>]*)(?:>([\s\S]*?)<\/\1>|\/?>)/gi)];
  const applicationActionFound = controls.some(([, tag, attrs, body = ""]) => {
    if (/\bdisabled\b|aria-disabled\s*=\s*["']true|\bhidden\b/i.test(attrs)) return false;
    if (tag.toLowerCase() === "a" && !/\bhref\s*=\s*["'](?:https?:|\/|#)/i.test(attrs)) return false;
    const label = identityText(body.replace(/<[^>]*>/g, " ") + " " + attrs.match(/(?:value|aria-label)\s*=\s*["']([^"']*)/i)?.[1]);
    return /\b(postuler|candidater|apply|envoyer ma candidature|je postule)\b/.test(label);
  });
  if (!applicationActionFound) return null;
  return { kind: "application-page", checkedAt: new Date(now).toISOString(), url: offer.applicationUrl || offer.sourceUrl, validThrough: job.validThrough, jobIdentityMatched: true, applicationActionFound: true };
}

export async function checkApplicationPage(value, offer, now = Date.now()) {
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
      if (evidence) return { state: "closed", evidence };
      const positive = openApplicationEvidence(html, offer, now);
      return positive ? { state: "open", evidence: positive } : { state: "unknown" };
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
  let cursor = 0, closed = 0, opened = 0, inconclusive = 0;
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++], candidate = JSON.parse(row.payload);
      const result = await check(candidate.applicationUrl || candidate.sourceUrl, candidate, now);
      if (result.state === "unknown") inconclusive++;
      store.transaction(() => {
        const latest = store.db.prepare("SELECT payload FROM offers WHERE id=?").get(row.id);
        if (!latest) return;
        const offer = JSON.parse(latest.payload);
        if (offer.applicationUrl !== candidate.applicationUrl || offer.sourceUrl !== candidate.sourceUrl) return;
        offer.availabilityCheckedAt = new Date(now).toISOString();
        if (result.state === "open" && hasRecentOpenEvidence({ ...offer, availabilityEvidence: result.evidence }, now)) {
          offer.availabilityEvidence = result.evidence;
          opened++;
        } else {
          // A previously open vacancy whose recheck fails is hidden immediately.
          delete offer.availabilityEvidence;
        }
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
  return { checked: rows.length, closed, opened, inconclusive };
}
