import test from "node:test";
import assert from "node:assert/strict";
import { isNonProductionOffer } from "../shared/production-policy.js";
import { parseLba, lbaSource } from "../server/ingestion/lba.js";
import { parseFeed } from "../server/ingestion/connectors.js";
import { normalizeRecord } from "../server/ingestion/pipeline.js";
const fixture = () => ({
  identifier: { id: "fiction-relay", partner_label: "France Travail" },
  is_delegated: false,
  workplace: {
    name: "Entreprise fictive de test",
    siret: "12345678900011",
    domain: { naf: { code: "4711D", label: "Commerce" } },
    location: { address: "1 rue fictive 44000 Nantes" },
  },
  contract: { type: ["Apprentissage"] },
  offer: {
    title: "Apprentissage commercial — exemple fictif",
    description: "Exemple fictif réservé aux tests.",
    status: "Active",
    rome_codes: ["D1401"],
    publication: {
      creation: new Date().toISOString(),
      expiration: new Date(Date.now() + 10 * 86400000).toISOString(),
    },
  },
  apply: {
    url: "https://candidat.francetravail.fr/offres/recherche/detail/test-only",
  },
});
test("non-production provenance is rejected without banning legitimate software test roles", () => {
  for (const sourceUrl of [
    "http://localhost/job",
    "https://labonnealternance-recette.apprentissage.beta.gouv.fr/job",
    "https://ppd-hub-alternance.opcoep.fr/job",
    "https://rec-hub-alternance.opcoep.fr/job",
  ])
    assert.equal(isNonProductionOffer({ sourceUrl }), true);
  for (const title of [
    "TITRE PERSONNALISE TEST",
    "Annonce de test",
    "Offre fictive",
    "turlututu",
  ])
    assert.equal(isNonProductionOffer({ title }), true);
  assert.equal(
    isNonProductionOffer({
      title: "Offre de stage ingénieur test logiciel",
      sourceUrl: "https://example.org/job",
    }),
    false,
  );
  const sample = fixture();
  sample.apply.url = "https://ppd-hub-alternance.opcoep.fr/job";
  assert.equal(
    parseLba({ jobs: [sample] }, Date.now(), { includeFranceTravail: true })
      .length,
    0,
  );
});
test("France Travail relay through authorized LBA preserves provenance, original dates and absence of a human verification", () => {
  const sample = fixture(),
    body = JSON.stringify({ jobs: [sample] });
  assert.equal(parseLba(body).length, 0);
  const records = parseFeed(lbaSource, body);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourcePartner, "France Travail");
  const offer = normalizeRecord(records[0], lbaSource);
  assert.equal(offer.sourceId, "la-bonne-alternance");
  assert.equal(offer.sourcePartner, "France Travail");
  assert.equal(offer.sourcePublishedAt, sample.offer.publication.creation);
  assert.equal(offer.lastVerifiedAt, null);
  assert.equal(offer.sourcePolicyApproved, true);
});
