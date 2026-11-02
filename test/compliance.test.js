import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import {
  normalizeSubmission,
  publicOffer,
  nonComplianceReasons,
} from "../server/domain.js";
import { isTrainingEmployer } from "../shared/employer-policy.js";
import { parseLba } from "../server/ingestion/lba.js";
import { parseFranceTravail } from "../server/ingestion/france-travail.js";
const now = Date.now();
const base = () =>
  normalizeSubmission({
    title: "Exemple fictif — conformité",
    companyName: "Entreprise fictive de test",
    companyWebsite: "https://example.org",
    sourceUrl: "https://example.org/job/audit",
    consent: true,
    contract: "Stage",
    city: "Paris",
    region: "Île-de-France",
    domain: "Cybersécurité",
    description:
      "Exemple fictif : travail en partenariat avec une université, au sein de l’entreprise.",
    publishedAt: new Date(now).toISOString().slice(0, 10),
    expiresAt: new Date(now + 14 * 864e5).toISOString().slice(0, 10),
  });
test("Training employers are excluded including accented university names; legitimate companies and agency employers are retained", () => {
  for (const name of [
    "Sorbonne Université",
    "Université fictive",
    "École fictive",
    "Lycée fictif",
    "CFA fictif",
    "Campus fictif",
  ]) {
    assert.equal(isTrainingEmployer(name), true, name);
    assert.throws(() =>
      normalizeSubmission({
        ...base(),
        companyName: name,
        companyWebsite: "https://example.org",
        city: "Paris",
        region: "Île-de-France",
        consent: true,
      }),
    );
  }
  for (const name of [
    "Entreprise fictive de test",
    "Adecco",
    "Manpower",
    "Proman",
  ])
    assert.equal(isTrainingEmployer(name), false);
  assert.equal(
    isTrainingEmployer("Laboratoire fictif", "Enseignement supérieur"),
    true,
  );
  assert.equal(isTrainingEmployer("Entreprise fictive", "", "8559A"), true);
  const offer = { ...base(), moderationStatus: "approved" };
  assert.ok(publicOffer(offer));
  assert.equal(nonComplianceReasons(offer).length, 0);
});
test("Existing non-compliant offers are withdrawn at startup, counts match, history and decisions persist", async () => {
  const folder = await mkdtemp("/tmp/offres-compliance-");
  let store = new OfferStore(folder);
  try {
    const valid = {
      ...base(),
      moderationStatus: "approved",
      sourceId: "la-bonne-alternance",
      externalId: "fiction-legacy",
      sourceStatus: "Active",
      sourcePolicyApproved: true,
    };
    await store.submit(valid);
    // Simulate a historical database row imported before the stronger policy, never a public test fixture.
    const bad = {
      ...valid,
      company: { ...valid.company, name: "Sorbonne Université" },
    };
    store.db
      .prepare("UPDATE offers SET payload=? WHERE id=?")
      .run(JSON.stringify(bad), valid.id);
    store.close();
    store = new OfferStore(folder);
    assert.equal(store.lastComplianceAudit.withdrawn, 1);
    assert.equal((await store.query()).total, 0);
    assert.equal(await store.getPublic(valid.id), null);
    const retained = (await store.read())[0];
    assert.equal(retained.moderationStatus, "withdrawn");
    assert.equal(store.runs()[0].audit.reasons.training_employer, 1);
    await store.ingest({
      ...valid,
      company: { ...valid.company, name: "Entreprise fictive de test" },
      contentHash: "changed",
      lastFetchedAt: new Date().toISOString(),
    });
    assert.equal((await store.query()).total, 0);
    assert.equal((await store.read()).length, 1);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("Expiration audit is idempotent; malformed historical dates do not crash startup or create a verification date", async () => {
  const folder = await mkdtemp("/tmp/offres-expiration-audit-");
  let store = new OfferStore(folder);
  try {
    const original = { ...base(), moderationStatus: "approved" };
    await store.submit(original);
    const old = {
      ...original,
      publishedAt: new Date(now - 46 * 864e5).toISOString().slice(0, 10),
      expiresAt: "invalid",
    };
    store.db
      .prepare("UPDATE offers SET payload=? WHERE id=?")
      .run(JSON.stringify(old), original.id);
    store.close();
    store = new OfferStore(folder);
    assert.equal(store.lastComplianceAudit.expired, 1);
    assert.equal((await store.query()).total, 0);
    const archived = (await store.read())[0];
    assert.equal(archived.status, "expired");
    assert.equal(archived.lastVerifiedAt, null);
    assert.equal(store.auditPublicOffers().expired, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("Public safety net rejects ordinary contracts, non-technical fields, foreign locations, school employers and bad original links", () => {
  const offer = { ...base(), moderationStatus: "approved" };
  for (const fields of [
    { contract: "CDI" },
    { domain: "Marketing" },
    { location: { label: "Bruxelles", region: "Belgique" } },
    { company: { ...offer.company, name: "Université fictive" } },
    { sourceUrl: "https://www.google.com/search?q=job" },
    { expiresAt: "invalid" },
  ])
    assert.equal(publicOffer({ ...offer, ...fields }), null);
});

test("Both API connectors exclude university employers before publication", () => {
  const lba = parseLba({
    jobs: [
      {
        identifier: { partner_label: "Fournisseur fictif" },
        is_delegated: false,
        workplace: { name: "Sorbonne Université" },
      },
    ],
  });
  assert.equal(lba.length, 0);
  assert.equal(lba.exclusions.school, 1);
  const ft = parseFranceTravail({
    resultats: [
      {
        dateCreation: new Date().toISOString(),
        entreprise: { nom: "Université fictive" },
      },
    ],
  });
  assert.equal(ft.length, 0);
  assert.equal(ft.exclusions.school, 1);
});
