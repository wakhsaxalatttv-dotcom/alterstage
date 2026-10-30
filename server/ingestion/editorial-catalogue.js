import { searchText } from "../enrichment.js";
import { canonicalUrl } from "../store.js";
import { createHash } from "node:crypto";
import { externalOffers } from "../../shared/external-offers.js";
import { isRecentPublication } from "../../shared/freshness.js";
import { isBlockedSource } from "../../shared/source-policy.js";
import { normalizeSubmission, publicOffer } from "../domain.js";
// Existing sourced editorial announcements are not newly fetched or newly verified.
export async function seedEditorialCatalogue(
  store,
  references = externalOffers,
) {
  const report = {
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicate: 0,
    excluded: 0,
  };
  for (const ref of references) {
    if (
      !isRecentPublication(ref.publishedAt) ||
      isBlockedSource(ref) ||
      store.db
        .prepare("SELECT id FROM hidden_references WHERE id=?")
        .get(ref.id) ||
      store.db
        .prepare(
          "SELECT id FROM offers WHERE canonical_url=? AND moderation IN ('withdrawn','rejected')",
        )
        .get(canonicalUrl(ref.sourceUrl))
    ) {
      report.excluded++;
      continue;
    }
    const observedAt = ref.sourceConsultedAt;
    if (
      !observedAt ||
      !Number.isFinite(Date.parse(observedAt)) ||
      Date.parse(observedAt) > Date.now()
    ) {
      report.excluded++;
      continue;
    }
    const deadline = Math.min(
      Date.parse(ref.publishedAt) + 46 * 86400000,
      Date.parse(observedAt) + 8 * 86400000,
    );
    if (deadline <= Date.now()) {
      report.excluded++;
      continue;
    }
    let offer;
    try {
      offer = normalizeSubmission(
        {
          title: ref.title,
          companyName: ref.company.name,
          companyWebsite: ref.companyWebsite,
          companyDescription: ref.companySummary || "",
          profileSourceUrl: ref.sourceUrl,
          city: ref.location.label,
          region: ref.location.region,
          domain: ref.domain,
          contract: ref.contract,
          description: ref.summary,
          missions: (ref.missions || []).join("\n"),
          skills: [ref.profile, ...(ref.technologies || [])]
            .filter(Boolean)
            .join("\n"),
          publishedAt: ref.publishedAt,
          sourceUrl: ref.sourceUrl,
          applicationUrl: ref.applicationUrl || ref.sourceUrl,
          expiresAt: new Date(deadline).toISOString().slice(0, 10),
          duration: ref.duration || "",
          consent: true,
          origin: "editorial",
        },
        { allowOlderActiveSource: true },
      );
    } catch {
      report.excluded++;
      continue;
    }
    const known = store.db
      .prepare("SELECT id,payload FROM companies WHERE name_key=?")
      .all(searchText(ref.company.name))
      .map((row) => ({ id: row.id, ...JSON.parse(row.payload) }))
      .find(
        (c) =>
          c.website &&
          new URL(c.website).hostname === new URL(ref.companyWebsite).hostname,
      );
    offer.company.id =
      known?.id ||
      "employer-company:" +
        createHash("sha256")
          .update(ref.company.name + "|" + ref.companyWebsite)
          .digest("hex")
          .slice(0, 20);
    Object.assign(offer, {
      id: ref.id,
      sourceId: "employer-editorial",
      sourceName: ref.sourceName,
      source: `Annonce employeur · ${ref.sourceName}`,
      externalId: ref.id,
      sourcePolicyApproved: true,
      sourcePublishedAt: ref.publishedAt,
      sourceConsultedAt: observedAt,
      lastFetchedAt: observedAt,
      lastVerifiedAt: null,
      technicalReviewAt: null,
      editorialSummary: true,
      education: ref.education || [],
    });
    offer.contentHash = createHash("sha256")
      .update(
        JSON.stringify({
          title: offer.title,
          description: offer.description,
          publishedAt: offer.publishedAt,
          sourceUrl: offer.sourceUrl,
          expiresAt: offer.expiresAt,
        }),
      )
      .digest("hex");
    if (!publicOffer({ ...offer, moderationStatus: "approved" })) {
      report.excluded++;
      continue;
    }
    const result = await store.ingest(offer);
    if (Object.hasOwn(report, result)) report[result]++;
  }
  return report;
}
