import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSubmission,
  deduplicate,
  safeUrl,
  publicOffer,
} from "../server/domain.js";
import {
  selectOffers,
  defaultFilters,
  regionOf,
  freshness,
} from "../src/domain.js";
export const fixture = () => ({
  title: "Exemple fictif — démonstration technique",
  companyName: "Entreprise fictive de test",
  companyWebsite: "https://example.org/",
  sourceUrl: "https://example.org/jobs/fixture",
  contract: "Apprentissage",
  city: "Paris",
  region: "Île-de-France",
  domain: "Cybersécurité",
  education: "Bac + 3",
  description:
    "Annonce fictive de test, jamais publiée dans le catalogue de production.",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  consent: true,
});
const offer = normalizeSubmission(fixture());
test("a submission never invents publication, verification or a contact", () => {
  const o = normalizeSubmission({ ...fixture(), publishedAt: "" });
  assert.equal(o.publishedAt, null);
  assert.equal(o.lastVerifiedAt, null);
  assert.equal(o.moderationStatus, "pending");
  assert.deepEqual(o.publicContacts, []);
  assert.equal(freshness(o), "À vérifier");
});
test("only technical/IT apprenticeship or internship submissions enter the queue", () => {
  for (const fields of [
    { domain: "Marketing" },
    { contract: "CDI" },
    { companyName: "CFA de test" },
    { region: "Étranger" },
    { consent: false },
  ])
    assert.throws(() => normalizeSubmission({ ...fixture(), ...fields }));
});
test("reject unsafe URLs, future/fabricated dates and stale submissions", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.org",
    "https://127.0.0.1",
    "https://localhost",
    "https://u:p@example.org/",
  ])
    assert.equal(safeUrl(url), null);
  for (const publishedAt of ["2035-01-01", "2026-02-30", "2020-01-01"])
    assert.throws(() => normalizeSubmission({ ...fixture(), publishedAt }));
});
test("public contacts require a generic company mailbox, consent, and provenance", () => {
  const generic = {
    ...fixture(),
    publicEmail: "recrutement@example.org",
    contactProvenance: "https://example.org/contact",
    contactConsent: true,
  };
  assert.equal(
    normalizeSubmission(generic).publicContacts[0].provenance,
    generic.contactProvenance,
  );
  for (const fields of [
    { publicEmail: "prenom.nom@example.org" },
    { contactConsent: false },
    { contactProvenance: "https://other.example.org.uk/" },
    { publicEmail: "jobs@elsewhere.org" },
  ])
    assert.throws(() => normalizeSubmission({ ...generic, ...fields }));
});
test("deduplicate by URL including tracking, or title/company/location", () => {
  assert.equal(
    deduplicate([
      offer,
      {
        ...offer,
        id: "other",
        sourceUrl: offer.sourceUrl + "?utm_source=test",
      },
    ]).length,
    1,
  );
  assert.equal(
    deduplicate([
      offer,
      { ...offer, id: "other", sourceUrl: "https://example.org/other" },
    ]).length,
    1,
  );
});
test("combined filters, broad families, sort and region work together", () => {
  const f = {
    ...defaultFilters,
    query: "fictif",
    region: "Île-de-France",
    group: "Informatique",
    domain: "Cybersécurité",
    education: "Bac + 3",
    contract: "Apprentissage",
    age: "7",
  };
  assert.equal(selectOffers([offer], f).length, 1);
  assert.equal(selectOffers([offer], { ...f, group: "Technique" }).length, 0);
  assert.equal(selectOffers([offer], { ...f, region: "Bretagne" }).length, 0);
  assert.equal(
    regionOf({ ...offer, location: { commune: "75056" } }),
    "Île-de-France",
  );
  assert.equal(
    selectOffers([{ ...offer, domain: "Marketing" }], defaultFilters).length,
    0,
  );
});
test("only approved in-scope non-expired records are public; verification becomes stale", () => {
  assert.equal(publicOffer(offer), null);
  const approved = {
    ...offer,
    moderationStatus: "approved",
    status: "active",
    lastVerifiedAt: new Date().toISOString(),
  };
  assert.equal(publicOffer(approved).status, "active");
  assert.equal(
    publicOffer({
      ...approved,
      lastVerifiedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    }).status,
    "to_verify",
  );
  assert.equal(publicOffer({ ...approved, expiresAt: "2020-01-01" }), null);
  assert.equal(publicOffer({ ...approved, status: "withdrawn" }), null);
  assert.equal(publicOffer({ ...approved, domain: "Marketing" }), null);
});

test("search results cannot be passed off as original company postings", () => {
  assert.throws(() =>
    normalizeSubmission({
      ...fixture(),
      sourceUrl: "https://www.google.com/search?q=stage",
    }),
  );
  assert.throws(() =>
    normalizeSubmission({
      ...fixture(),
      sourceUrl: "https://candidat.francetravail.fr/offres/test",
    }),
  );
});
