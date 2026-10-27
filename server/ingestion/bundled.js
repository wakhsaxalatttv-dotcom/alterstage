import { readFile } from "node:fs/promises";
import { publicOffer } from "../domain.js";
/** Non-secret, dated public catalogue snapshot; never overrides a moderator's rejection or withdrawal. */
export async function seedBundledCatalogue(
  store,
  file = new URL("../../config/market-offers.json", import.meta.url),
) {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (
    snapshot.source !== "la-bonne-alternance" ||
    !Array.isArray(snapshot.offers)
  )
    throw new Error("Instantané de marché invalide");
  for (const offer of snapshot.offers) {
    const existing = store.db
      .prepare("SELECT payload FROM offers WHERE source_id=? AND external_id=?")
      .get(offer.sourceId, offer.externalId);
    if (
      existing &&
      JSON.parse(existing.payload).lastFetchedAt >= offer.lastFetchedAt
    )
      continue;
    if (
      offer.sourceId !== "la-bonne-alternance" ||
      offer.lastVerifiedAt ||
      !offer.sourcePolicyApproved
    )
      continue;
    if (publicOffer({ ...offer, moderationStatus: "approved" }))
      await store.ingest(offer);
  }
}
