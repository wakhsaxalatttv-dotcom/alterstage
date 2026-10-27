import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { parseLba, lbaSource } from "../server/ingestion/lba.js";
import { normalizeRecord } from "../server/ingestion/pipeline.js";
import { OfferStore } from "../server/store.js";
import { publicOffer } from "../server/domain.js";
import { seedBundledCatalogue } from "../server/ingestion/bundled.js";
const past = () => new Date(Date.now() - 45 * 86400000).toISOString();
const future = () => new Date(Date.now() + 10 * 86400000).toISOString();
const fixture = () => ({
  identifier: {
    id: "fiction-lba-1",
    partner_job_id: "fiction-1",
    partner_label: "Fournisseur fictif",
  },
  is_delegated: false,
  workplace: {
    name: "Entreprise fictive de test",
    website: null,
    siret: "12345678900011",
    location: { address: "1 rue fictive 44000 Nantes" },
    domain: { naf: { code: "6201Z", label: "Programmation informatique" } },
    description: "",
  },
  contract: {
    type: ["Apprentissage", "Professionnalisation"],
    duration: 12,
    start: null,
  },
  offer: {
    title: "Exemple fictif — démonstration LBA",
    description: "Poste fictif Linux. Ne pas publier comme une vraie annonce.",
    status: "Active",
    rome_codes: ["M1801"],
    publication: { creation: past(), expiration: future() },
    desired_skills: [],
    target_diploma: null,
  },
  apply: { url: "https://example.org/jobs/fiction", phone: "0102030405" },
});
test("LBA rejects sandbox, schools, spontaneous recruiters, inactive and France Travail entries", () => {
  const base = fixture();
  const school = fixture();
  school.is_delegated = true;
  const sandbox = fixture();
  sandbox.identifier.partner_label = "sandbox:fiction";
  const ft = fixture();
  ft.identifier.partner_label = "France Travail";
  const closed = fixture();
  closed.offer.status = "Filled";
  const records = parseLba({
    jobs: [base, school, sandbox, ft, closed],
    recruiters: [{ name: "not an offer" }],
  });
  assert.equal(records.length, 1);
  assert.equal(records.exclusions.sandbox, 1);
  assert.equal(records.exclusions.school, 1);
  assert.equal(records.exclusions.franceTravail, 1);
  assert.equal(records.exclusions.inactive, 1);
  assert.equal(records.exclusions.recruiters, 1);
});
test("explicitly allowed older active offers retain their original dates, both contracts, and no invented website or verification", () => {
  const raw = fixture(),
    record = parseLba({ jobs: [raw] })[0],
    offer = normalizeRecord(record, lbaSource);
  assert.equal(offer.publishedAt, raw.offer.publication.creation.slice(0, 10));
  assert.deepEqual(offer.acceptedContracts, [
    "Apprentissage",
    "Contrat de professionnalisation",
  ]);
  assert.equal(offer.company.website, null);
  assert.equal(offer.lastVerifiedAt, null);
  assert.equal(offer.sourcePolicyApproved, true);
  assert.equal(offer.location.region, "Pays de la Loire");
  assert.equal(offer.publicContacts.length, 0);
  assert.ok(!JSON.stringify(offer).includes("0102030405"));
});
test("authorized LBA records are visible unverified and filterable by either contract; generic sources remain pending", async () => {
  const folder = await mkdtemp("/tmp/offres-lba-test-"),
    store = new OfferStore(folder);
  try {
    const offer = normalizeRecord(
      parseLba({ jobs: [fixture()] })[0],
      lbaSource,
    );
    await store.ingest(offer);
    assert.equal((await store.query()).total, 1);
    assert.equal(
      (await store.query({ contract: "Contrat de professionnalisation" }))
        .total,
      1,
    );
    const publicRecord = (await store.query()).offers[0];
    assert.equal(publicRecord.lastVerifiedAt, null);
    assert.equal(publicRecord.status, "to_verify");
    assert.equal(
      publicOffer({
        ...offer,
        moderationStatus: "approved",
        sourceExpiresAt: "2020-01-01",
      }),
      null,
    );
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("bundled snapshot starts a fresh deployment, is idempotent, and cannot undo a withdrawal", async () => {
  const folder = await mkdtemp("/tmp/offres-lba-bundle-"),
    store = new OfferStore(folder);
  try {
    const offer = normalizeRecord(
      parseLba({ jobs: [fixture()] })[0],
      lbaSource,
    );
    const file = folder + "/snapshot.json";
    await writeFile(
      file,
      JSON.stringify({ source: lbaSource.id, offers: [offer] }),
    );
    await seedBundledCatalogue(store, file);
    await seedBundledCatalogue(store, file);
    assert.equal((await store.query()).total, 1);
    const id = (await store.read())[0].id;
    await store.review(id, { action: "withdraw" });
    await seedBundledCatalogue(store, file);
    assert.equal((await store.query()).total, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
