import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { normalizeSubmission } from "../server/domain.js";
import { normalizeHostingReview } from "../server/company-catalogue.js";
import {
  isHostingReviewCurrent,
  HOSTING_REVIEW_DAYS,
} from "../shared/company.js";
import { createApp } from "../server/app.js";
const review = () => ({
  acceptedContracts: ["Stage", "Apprentissage"],
  sourceUrl: "https://example.org/hosting",
  identityChecked: true,
  conditionsChecked: true,
  sourceChecked: true,
  rhythms: "3 semaines / 1 semaine",
  size: "10–49 salariés",
  stack: "Linux; Python",
  locations: "Nantes; Lyon",
});
async function withStore(run) {
  const folder = await mkdtemp("/tmp/offres-company-test-");
  const store = new OfferStore(folder);
  try {
    await run(store, folder);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
}
function sample(index = 0) {
  return normalizeSubmission({
    title: `Exemple fictif — stage ${index}`,
    companyName: `Entreprise fictive ${index}`,
    companyWebsite: `https://company-${index}.example.org`,
    sourceUrl: `https://example.org/company-job/${index}`,
    description: "Exemple fictif de test uniquement, Linux et Python.",
    domain: "Systèmes, réseaux & cloud",
    contract: "Stage",
    city: "Nantes",
    region: "Pays de la Loire",
    publishedAt: new Date().toISOString().slice(0, 10),
    expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    consent: true,
  });
}
test("Expanded directory contains 56 sourced profiles but no invented hosting criteria, size, stack or contacts", () =>
  withStore(async (store) => {
    assert.equal((await store.companies()).total, 56);
    assert.equal((await store.query()).total, 0);
    const found = await store.companies({ query: "Jolicode" });
    assert.equal(found.total, 1);
    const c = found.companies[0];
    assert.equal(c.hostingStatus, "unconfirmed");
    assert.equal(c.size, null);
    assert.deepEqual(c.stack, []);
    assert.deepEqual(c.publicContacts, []);
    assert.equal(c.offerCount, 0);
    assert.ok(c.fieldEvidence.name.sourceUrl.startsWith("https://github.com/"));
    assert.ok(c.identityCheckedAt);
    assert.equal((await store.companies({ hosting: "reviewed" })).total, 0);
    assert.equal((await store.companies({ query: '" OR 1=1 --' })).total, 0);
    assert.equal((await store.companies({ page: 2 })).companies.length, 12);
  }));
test("Hosting badge needs explicit contract, source and all attestations; it expires after 90 days", () => {
  for (const extra of [
    { sourceChecked: false },
    { identityChecked: false },
    { conditionsChecked: false },
    { acceptedContracts: [] },
    { acceptedContracts: ["CDI"] },
    { sourceUrl: "http://localhost" },
  ])
    assert.throws(() => normalizeHostingReview({ ...review(), ...extra }));
  const checked = normalizeHostingReview(review());
  assert.equal(isHostingReviewCurrent(checked), true);
  assert.equal(
    isHostingReviewCurrent({
      ...checked,
      reviewedAt: new Date(
        Date.now() - (HOSTING_REVIEW_DAYS + 1) * 864e5,
      ).toISOString(),
    }),
    false,
  );
  assert.equal(
    isHostingReviewCurrent({
      ...checked,
      reviewedAt: new Date(Date.now() + 864e5).toISOString(),
    }),
    false,
  );
  assert.equal(isHostingReviewCurrent({ ...checked, sourceUrl: null }), false);
});
test("Company search combines sourced size, city, expertise, contract and current hosting review; revocation invalidates caches", () =>
  withStore(async (store) => {
    const id = "jolicode.com";
    await store.reviewCompany(id, review());
    const match = await store.companies({
      query: "Jolicode",
      type: "ESN",
      size: "10–49 salariés",
      city: "Lyon",
      tag: "Dév Web/Cloud",
      contract: "Stage",
      hosting: "reviewed",
    });
    assert.equal(match.total, 1);
    assert.equal(match.companies[0].hostingStatus, "reviewed");
    const profile = await store.company(id);
    assert.equal(profile.fieldEvidence.stack.sourceUrl, review().sourceUrl);
    assert.deepEqual(profile.stack, ["Linux", "Python"]);
    assert.equal(
      (
        await store.companies({
          query: "Jolicode",
          contract: "Contrat de professionnalisation",
        })
      ).total,
      0,
    );
    await store.reviewCompany(id, { action: "revoke" });
    assert.equal(
      (await store.companies({ query: "Jolicode", hosting: "reviewed" })).total,
      0,
    );
    assert.equal((await store.company(id)).hostingStatus, "unconfirmed");
  }));
test("Recent offer evidence is separate from company hosting checks and vanishes on withdrawal", () =>
  withStore(async (store) => {
    const o = sample();
    await store.submit(o);
    await store.review(o.id, {
      action: "approve",
      sourceChecked: true,
      companyChecked: true,
      contactChecked: true,
      rightsChecked: true,
    });
    const found = await store.companies({
      query: "Entreprise fictive",
      city: "Nantes",
      hosting: "offers",
      contract: "Stage",
    });
    assert.equal(found.total, 1);
    assert.equal(found.companies[0].hostingStatus, "offers");
    assert.deepEqual(found.companies[0].currentContracts, ["Stage"]);
    assert.equal(found.companies[0].hostingReview, null);
    assert.equal(
      (
        await store.companies({
          query: "Entreprise fictive",
          hosting: "reviewed",
        })
      ).total,
      0,
    );
    await store.review(o.id, { action: "withdraw" });
    assert.equal(
      (
        await store.companies({
          query: "Entreprise fictive",
          hosting: "offers",
        })
      ).total,
      0,
    );
    assert.equal((await store.company(o.company.id)).offerCount, 0);
  }));
test("API refresh preserves manually reviewed company criteria, provenance and normalized indexes", () =>
  withStore(async (store) => {
    await store.reviewCompany("jolicode.com", review());
    store.transaction(() =>
      store.saveCompany(
        {
          id: "jolicode.com",
          name: "JoliCode",
          website: "https://jolicode.com",
          type: null,
          size: null,
          stack: [],
          tags: [],
        },
        null,
        [],
      ),
    );
    const profile = await store.company("jolicode.com");
    assert.equal(profile.size, "10–49 salariés");
    assert.deepEqual(profile.stack, ["Linux", "Python"]);
    assert.equal(profile.hostingStatus, "reviewed");
    assert.equal(
      (
        await store.companies({
          query: "JoliCode",
          size: "10–49 salariés",
          tag: "Dév Web/Cloud",
        })
      ).total,
      1,
    );
  }));
test("Expired hosting reviews never match the validated filter and school profiles are excluded", () =>
  withStore(async (store) => {
    await store.reviewCompany("jolicode.com", review());
    const past = new Date(Date.now() - 100 * 864e5).toISOString();
    const row = store.db
      .prepare("SELECT payload FROM company_hosting_reviews WHERE company_id=?")
      .get("jolicode.com");
    const data = JSON.parse(row.payload);
    data.reviewedAt = past;
    store.db
      .prepare(
        "UPDATE company_hosting_reviews SET reviewed_at=?,valid_until=?,payload=? WHERE company_id=?",
      )
      .run(past, Date.now() - 1000, JSON.stringify(data), "jolicode.com");
    store.cache.clear();
    assert.equal(
      (await store.companies({ query: "Jolicode", hosting: "reviewed" })).total,
      0,
    );
    assert.equal(
      (await store.company("jolicode.com")).hostingStatus,
      "unconfirmed",
    );
    store.transaction(() =>
      store.saveCompany(
        {
          id: "school.example.org",
          name: "Université fictive",
          website: "https://school.example.org",
          tags: [],
          locations: [],
        },
        null,
        [],
      ),
    );
    assert.equal(
      (await store.companies({ query: "Université fictive" })).total,
      0,
    );
    assert.equal(await store.company("school.example.org"), null);
    await assert.rejects(store.reviewCompany("school.example.org", review()));
  }));
test("Review endpoints require administration authentication and never publish or create an offer", async () => {
  const folder = await mkdtemp("/tmp/company-http-test-");
  const token = "test-only-admin-" + "c".repeat(40);
  const app = createApp({
    folder,
    adminToken: token,
    pipelineOptions: { sources: async () => [] },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (
        await fetch(url + "/api/admin/companies/jolicode.com/review", {
          method: "POST",
        })
      ).status,
      401,
    );
    const response = await fetch(
      url + "/api/admin/companies/jolicode.com/review",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(review()),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(
      (await fetch(url + "/api/companies/jolicode.com").then((r) => r.json()))
        .company.hostingStatus,
      "reviewed",
    );
    assert.equal((await app.locals.store.query()).total, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("An explicit company review may clear unsupported profile fields while later API refreshes cannot erase verified information", () =>
  withStore(async (store) => {
    await store.reviewCompany("jolicode.com", review());
    await store.reviewCompany("jolicode.com", {
      ...review(),
      size: "",
      rhythms: "",
      stack: "",
      locations: "",
    });
    const profile = await store.company("jolicode.com");
    assert.equal(profile.size, null);
    assert.equal(profile.rhythm, null);
    assert.deepEqual(profile.stack, []);
    assert.deepEqual(profile.locations, []);
    assert.equal(profile.hostingStatus, "reviewed");
    assert.equal(profile.fieldEvidence.stack, undefined);
  }));
