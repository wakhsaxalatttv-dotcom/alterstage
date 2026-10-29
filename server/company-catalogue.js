import { isTrainingEmployer } from "../shared/employer-policy.js";
import directory from "../config/company-directory.json" with { type: "json" };
import { contracts } from "../shared/catalog.js";
import {
  companySizes,
  companyTags,
  HOSTING_REVIEW_DAYS,
  isHostingReviewCurrent,
} from "../shared/company.js";
import { safeUrl, ValidationError } from "./domain.js";
import { searchText, plainText } from "./enrichment.js";
const decode = (row) => JSON.parse(row.payload);
const list = (value) =>
  [
    ...new Set(
      (Array.isArray(value) ? value : String(value || "").split(/[,;\n]/))
        .map((v) => plainText(String(v), 120))
        .filter(Boolean),
    ),
  ].slice(0, 20);
export function normalizeHostingReview(body, now = new Date().toISOString()) {
  if (
    !body ||
    body.identityChecked !== true ||
    body.conditionsChecked !== true ||
    body.sourceChecked !== true
  )
    throw new ValidationError(
      "Confirmez l’identité de l’entreprise, la source et les conditions d’accueil avant validation.",
    );
  const acceptedContracts = list(body.acceptedContracts);
  if (
    !acceptedContracts.length ||
    acceptedContracts.some((c) => !contracts.includes(c))
  )
    throw new ValidationError(
      "Choisissez au moins un contrat de stage ou d’alternance confirmé par la source.",
    );
  const sourceUrl = safeUrl(body.sourceUrl);
  if (!sourceUrl)
    throw new ValidationError(
      "Indiquez une source HTTPS publique pour les conditions d’accueil.",
    );
  if (body.size && !companySizes.includes(body.size))
    throw new ValidationError("Taille d’entreprise invalide.");
  return {
    acceptedContracts,
    rhythms: list(body.rhythms),
    sourceUrl,
    reviewedAt: now,
    identityChecked: true,
    conditionsChecked: true,
    sourceChecked: true,
    method: "manual",
    size: body.size || null,
    stack: list(body.stack),
    locations: list(body.locations),
  };
}
export class CompanyCatalogue {
  constructor(store) {
    this.store = store;
    this.db = store.db;
  }
  index(company) {
    this.db
      .prepare("DELETE FROM company_exclusions WHERE company_id=?")
      .run(company.id);
    if (isTrainingEmployer(company.name, company.sector, company.nafCode))
      this.db
        .prepare("INSERT INTO company_exclusions(company_id) VALUES(?)")
        .run(company.id);
    this.db
      .prepare("DELETE FROM company_search WHERE company_id=?")
      .run(company.id);
    this.db
      .prepare("INSERT INTO company_search(company_id,document) VALUES(?,?)")
      .run(
        company.id,
        [
          company.name,
          company.sector,
          ...(company.tags || []),
          ...(company.stack || []),
        ]
          .filter(Boolean)
          .join(" "),
      );
    this.db
      .prepare("DELETE FROM company_tag_index WHERE company_id=?")
      .run(company.id);
    for (const tag of new Set(company.tags || []))
      if (companyTags.includes(tag))
        this.db
          .prepare("INSERT INTO company_tag_index(company_id,tag) VALUES(?,?)")
          .run(company.id, tag);
    this.db
      .prepare("DELETE FROM company_location_index WHERE company_id=?")
      .run(company.id);
    for (const location of new Set(
      [company.location, ...(company.locations || [])]
        .filter(Boolean)
        .map(searchText),
    ))
      this.db
        .prepare(
          "INSERT INTO company_location_index(company_id,location_key) VALUES(?,?)",
        )
        .run(company.id, location);
  }
  seed() {
    this.store.transaction(() => {
      for (const item of directory.companies) {
        const website = safeUrl(item.website);
        const id = website
          ? new URL(website).hostname.replace(/^www\./, "")
          : item.id;
        const previous = this.db
          .prepare("SELECT payload FROM companies WHERE id=?")
          .get(id);
        if (
          previous &&
          (!decode(previous).researchLead || decode(previous).profileVerifiedAt)
        )
          continue;
        this.store.saveCompany(
          {
            ...item,
            id,
            website,
            sector: item.focus,
            description: null,
            size: null,
            locations: [],
            stack: [],
            rhythm: null,
            certifications: [],
            publicContacts: [],
            researchLead: true,
            profileSourceUrl: item.identitySourceUrl,
            identityCheckedAt: item.identityCheckedAt,
          },
          null,
          [],
        );
      }
      for (const row of this.db.prepare("SELECT payload FROM companies").all())
        this.index(decode(row));
    });
  }
  offerContracts(ids) {
    if (!ids.length) return new Map();
    const { sql, params } = this.store.publicConditions();
    const rows = this.db
      .prepare(
        `SELECT o.company_id,oc.contract FROM offers o JOIN offer_contracts oc ON oc.offer_id=o.id WHERE o.company_id IN (${ids.map(() => "?").join(",")}) AND o.id IN (SELECT id FROM offers WHERE ${sql}) GROUP BY o.company_id,oc.contract`,
      )
      .all(...ids, ...params);
    const result = new Map();
    for (const row of rows)
      result.set(row.company_id, [
        ...(result.get(row.company_id) || []),
        row.contract,
      ]);
    return result;
  }
  decorate(
    company,
    review,
    offerCount = 0,
    now = Date.now(),
    currentContracts = [],
  ) {
    const hostingReview = review || null;
    const current = isHostingReviewCurrent(hostingReview, now);
    return {
      ...company,
      hostingReview,
      hostingStatus: current
        ? "reviewed"
        : offerCount > 0
          ? "offers"
          : "unconfirmed",
      offerCount,
      currentContracts,
    };
  }
  async list(filters = {}) {
    this.store.freshCache();
    const key = "companies:" + JSON.stringify(filters),
      cached = this.store.cache.get(key);
    if (cached) return cached;
    const { sql, params } = this.store.publicConditions();
    const conditions = [
        "c.id NOT IN (SELECT company_id FROM company_exclusions)",
      ],
      args = [];
    if (filters.query) {
      const terms =
        String(filters.query)
          .slice(0, 100)
          .match(/[\p{L}\p{N}]+/gu)
          ?.slice(0, 8) || [];
      if (terms.length) {
        conditions.push(
          "c.id IN (SELECT company_id FROM company_search WHERE company_search MATCH ?)",
        );
        args.push(terms.map((t) => `"${t}"*`).join(" AND "));
      }
    }
    for (const field of ["type", "size"])
      if (filters[field]) {
        conditions.push(`c.${field}=?`);
        args.push(String(filters[field]).slice(0, 60));
      }
    if (filters.tag) {
      conditions.push(
        "c.id IN (SELECT company_id FROM company_tag_index WHERE tag=?)",
      );
      args.push(String(filters.tag).slice(0, 80));
    }
    if (filters.city) {
      const city = searchText(String(filters.city).slice(0, 100));
      conditions.push(
        `(c.id IN (SELECT company_id FROM company_location_index WHERE location_key>=? AND location_key<?) OR c.id IN (SELECT company_id FROM offers WHERE ${sql} AND city_key>=? AND city_key<?))`,
      );
      args.push(city, city + "\uffff", ...params, city, city + "\uffff");
    }
    const fresh =
      "c.id IN (SELECT company_id FROM company_hosting_reviews WHERE valid_until>?)";
    const hiring = `EXISTS(SELECT 1 FROM offers WHERE company_id=c.id AND ${sql})`;
    if (filters.hosting === "reviewed") {
      conditions.push(fresh);
      args.push(Date.now());
    }
    if (filters.hosting === "offers") {
      conditions.push(hiring);
      args.push(...params);
    }
    if (filters.hosting === "unconfirmed") {
      conditions.push(`NOT (${fresh}) AND NOT (${hiring})`);
      args.push(Date.now(), ...params);
    }
    if (filters.contract) {
      if (!contracts.includes(filters.contract))
        throw new ValidationError("Contrat d’accueil invalide.");
      conditions.push(
        `((c.id IN (SELECT company_id FROM company_hosting_contracts WHERE contract=?) AND ${fresh}) OR EXISTS(SELECT 1 FROM offers WHERE company_id=c.id AND ${sql} AND id IN (SELECT offer_id FROM offer_contracts WHERE contract=?)))`,
      );
      args.push(filters.contract, Date.now(), ...params, filters.contract);
    }
    const where = conditions.join(" AND ");
    const total = Number(
      this.db
        .prepare(`SELECT count(*) AS n FROM companies c WHERE ${where}`)
        .get(...args).n,
    );
    const pageSize = 12,
      pages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(
        pages,
        Math.max(1, Math.trunc(Number(filters.page) || 1)),
      );
    const rows = this.db
      .prepare(
        `SELECT c.payload,r.payload AS hosting,(SELECT count(*) FROM offers WHERE company_id=c.id AND ${sql}) AS offer_count FROM companies c LEFT JOIN company_hosting_reviews r ON r.company_id=c.id WHERE ${where} ORDER BY c.name_key,c.id LIMIT ? OFFSET ?`,
      )
      .all(...params, ...args, pageSize, (page - 1) * pageSize);
    const currentContracts = this.offerContracts(
      rows.map((row) => decode(row).id),
    );
    const companies = rows.map((row) =>
      this.decorate(
        decode(row),
        row.hosting ? JSON.parse(row.hosting) : null,
        Number(row.offer_count),
        Date.now(),
        currentContracts.get(decode(row).id) || [],
      ),
    );
    return this.store.cache.set(
      key,
      { companies, total, page, pages, pageSize },
      this.ttl(),
    );
  }
  ttl() {
    const expiry = this.db
      .prepare(
        "SELECT min(valid_until) AS expiry FROM company_hosting_reviews WHERE valid_until>?",
      )
      .get(Date.now()).expiry;
    return expiry
      ? Math.max(1, Math.min(15000, Number(expiry) - Date.now()))
      : 15000;
  }
  async get(id) {
    this.store.freshCache();
    const key = "profile:" + id,
      cached = this.store.cache.get(key);
    if (cached) return cached;
    const row = this.db
      .prepare(
        "SELECT c.payload,r.payload AS hosting FROM companies c LEFT JOIN company_hosting_reviews r ON r.company_id=c.id WHERE c.id=?",
      )
      .get(id);
    if (
      !row ||
      isTrainingEmployer(
        decode(row).name,
        decode(row).sector,
        decode(row).nafCode,
      )
    )
      return null;
    const { sql, params } = this.store.publicConditions();
    const count = Number(
      this.db
        .prepare(
          `SELECT count(*) AS n FROM offers WHERE company_id=? AND ${sql}`,
        )
        .get(id, ...params).n,
    );
    const company = this.decorate(
      decode(row),
      row.hosting ? JSON.parse(row.hosting) : null,
      count,
      Date.now(),
      this.offerContracts([id]).get(id) || [],
    );
    return this.store.cache.set(key, company, this.ttl());
  }
  async review(id, body) {
    return this.store.transaction(() => {
      const row = this.db
        .prepare("SELECT payload FROM companies WHERE id=?")
        .get(id);
      if (!row) throw new ValidationError("Entreprise introuvable.");
      if (body?.action === "revoke") {
        this.db
          .prepare("DELETE FROM company_hosting_reviews WHERE company_id=?")
          .run(id);
        this.db
          .prepare("DELETE FROM company_hosting_contracts WHERE company_id=?")
          .run(id);
        return { id, hostingReview: null };
      }
      const review = normalizeHostingReview(body);
      const current = decode(row);
      if (isTrainingEmployer(current.name, current.sector, current.nafCode))
        throw new ValidationError(
          "Cet organisme de formation ne peut pas être validé comme entreprise d’accueil dans ce catalogue.",
        );
      const fields = {
        ...current.fieldEvidence,
        hosting: { sourceUrl: review.sourceUrl, checkedAt: review.reviewedAt },
      };
      for (const key of ["size", "stack", "locations"])
        if (review[key]?.length)
          fields[key] = {
            sourceUrl: review.sourceUrl,
            checkedAt: review.reviewedAt,
          };
      if (review.rhythms.length)
        fields.rhythm = {
          sourceUrl: review.sourceUrl,
          checkedAt: review.reviewedAt,
        };
      for (const key of ["size", "stack", "locations"])
        if (!review[key]?.length) delete fields[key];
      if (!review.rhythms.length) delete fields.rhythm;
      const profile = {
        ...current,
        size: review.size,
        stack: review.stack,
        locations: review.locations,
        rhythm: review.rhythms.length ? review.rhythms.join(" · ") : null,
        fieldEvidence: fields,
        profileSourceUrl: review.sourceUrl,
        profileVerifiedAt: review.reviewedAt,
      };
      this.store.saveCompany(
        profile,
        review.reviewedAt,
        current.publicContacts || [],
        { replaceProfileFields: true },
      );
      this.db
        .prepare(
          "INSERT INTO company_hosting_reviews(company_id,reviewed_at,valid_until,payload) VALUES(?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET reviewed_at=excluded.reviewed_at,valid_until=excluded.valid_until,payload=excluded.payload",
        )
        .run(
          id,
          review.reviewedAt,
          Date.parse(review.reviewedAt) + HOSTING_REVIEW_DAYS * 86400000,
          JSON.stringify(review),
        );
      this.db
        .prepare("DELETE FROM company_hosting_contracts WHERE company_id=?")
        .run(id);
      for (const contract of review.acceptedContracts)
        this.db
          .prepare(
            "INSERT INTO company_hosting_contracts(company_id,contract) VALUES(?,?)",
          )
          .run(id, contract);
      return { id, hostingReview: review };
    });
  }
}
