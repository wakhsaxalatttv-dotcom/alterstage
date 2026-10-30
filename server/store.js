import { isBlockedSource } from "../shared/source-policy.js";
import { CompanyCatalogue } from "./company-catalogue.js";
import {
  publicationCutoff,
  isRecentPublication,
  publicationIndex,
} from "../shared/freshness.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  publicOffer,
  nonComplianceReasons,
  ValidationError,
} from "./domain.js";
import { QueryCache } from "./cache.js";
import { searchText, extractKeywords } from "./enrichment.js";
import { directory, domains, contracts, groupOf } from "../shared/catalog.js";
export function canonicalUrl(value) {
  const u = new URL(value);
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith("utm_")) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href.replace(/\/$/, "");
}
const fingerprint = (o) =>
  createHash("sha256")
    .update(
      [o.title, o.company.name, o.location.label].map(searchText).join("|"),
    )
    .digest("hex");
const placeholders = (values) => values.map(() => "?").join(",");
const parse = (row) => JSON.parse(row.payload);
export class OfferStore {
  constructor(folder) {
    mkdirSync(folder, { recursive: true });
    this.db = new DatabaseSync(path.join(folder, "catalogue.sqlite"));
    chmodSync(path.join(folder, "catalogue.sqlite"), 0o600);
    this.db.exec(
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    this.cache = new QueryCache();
    this.version = this.db.prepare("PRAGMA data_version").get().data_version;
    this.publicationDay = publicationCutoff();
    this.companyCatalogue = new CompanyCatalogue(this);
    try {
      this.migrateLegacy(folder);
      this.seedDirectory();
      this.companyCatalogue.seed();
      this.lastComplianceAudit = this.auditPublicOffers();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  transaction(operation) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      this.cache.clear();
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  freshCache() {
    const version = this.db.prepare("PRAGMA data_version").get().data_version;
    const publicationDay = publicationCutoff();
    if (version !== this.version || publicationDay !== this.publicationDay) {
      this.cache.clear();
      this.version = version;
      this.publicationDay = publicationDay;
    }
  }
  migrateLegacy(folder) {
    if (
      this.db
        .prepare("SELECT value FROM metadata WHERE key='legacy_migrated'")
        .get()
    )
      return;
    const file = path.join(folder, "offers.json");
    const legacy = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : [];
    if (!Array.isArray(legacy))
      throw new Error(
        "Migration interrompue : offers.json doit contenir une liste. Original conservé.",
      );
    if (new Set(legacy.map((o) => o.id)).size !== legacy.length)
      throw new Error(
        "Migration interrompue : identifiants dupliqués. Original conservé.",
      );
    if (Number(this.db.prepare("SELECT count(*) AS n FROM offers").get().n) > 0)
      throw new Error(
        "Migration interrompue : base existante sans marqueur. Vérifier les sauvegardes.",
      );
    this.transaction(() => {
      for (const offer of legacy) {
        this.writeOffer(offer);
        if (offer.moderationStatus === "approved")
          this.saveCompany(
            offer.company,
            offer.lastVerifiedAt,
            offer.publicContacts,
          );
      }
      this.db
        .prepare("INSERT INTO metadata(key,value) VALUES('legacy_migrated',?)")
        .run(new Date().toISOString());
    });
  }
  seedDirectory() {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO companies(id,name,name_key,type,size,city_key,payload) VALUES(?,?,?,?,?,?,?)",
    );
    this.transaction(() => {
      for (const c of directory) {
        const id = new URL(c.website).hostname.replace(/^www\./, "");
        const company = {
          ...c,
          id,
          sector: c.focus,
          description: null,
          location: null,
          size: null,
          locations: [],
          stack: [],
          rhythm: null,
          certifications: [],
          tags: c.tags || [],
          profileSourceUrl: c.website,
          profileVerifiedAt: null,
          publicContacts: [],
          researchLead: true,
        };
        insert.run(
          id,
          c.name,
          searchText(c.name),
          c.type || null,
          null,
          "",
          JSON.stringify(company),
        );
      }
    });
  }
  saveCompany(
    company,
    verifiedAt,
    contacts = [],
    { replaceProfileFields = false } = {},
  ) {
    if (!verifiedAt) {
      const existing = this.db
        .prepare("SELECT payload FROM companies WHERE id=?")
        .get(company.id);
      if (existing && parse(existing).profileVerifiedAt) return;
    }
    const previousRow = this.db
      .prepare("SELECT payload FROM companies WHERE id=?")
      .get(company.id);
    const previous = previousRow ? parse(previousRow) : {};
    const supplied = Object.fromEntries(
      Object.entries(company).filter(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          (!Array.isArray(value) || value.length),
      ),
    );
    const profile = {
      ...previous,
      ...supplied,
      sector: company.sector || previous.sector || null,
      type: company.type || previous.type || null,
      size: replaceProfileFields
        ? company.size || null
        : company.size || previous.size || null,
      location: company.location || previous.location || null,
      tags: company.tags?.length ? company.tags : previous.tags || [],
      stack: replaceProfileFields
        ? company.stack || []
        : company.stack?.length
          ? company.stack
          : previous.stack || [],
      rhythm: replaceProfileFields
        ? company.rhythm || null
        : company.rhythm || previous.rhythm || null,
      locations: replaceProfileFields
        ? company.locations || []
        : company.locations?.length
          ? company.locations
          : previous.locations || [],
      identitySourceUrl:
        previous.identitySourceUrl || company.identitySourceUrl || null,
      identityCheckedAt:
        previous.identityCheckedAt || company.identityCheckedAt || null,
      fieldEvidence: replaceProfileFields
        ? company.fieldEvidence || {}
        : { ...previous.fieldEvidence, ...company.fieldEvidence },
      profileVerifiedAt: verifiedAt || null,
      publicContacts: contacts,
      researchLead: company.researchLead === true,
    };
    this.db
      .prepare(
        "INSERT INTO companies(id,name,name_key,type,size,city_key,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key,type=excluded.type,size=excluded.size,city_key=excluded.city_key,payload=excluded.payload",
      )
      .run(
        profile.id,
        profile.name,
        searchText(profile.name),
        profile.type || null,
        profile.size || null,
        searchText([profile.location, ...(profile.locations || [])].join(" ")),
        JSON.stringify(profile),
      );
    this.companyCatalogue?.index(profile);
  }
  writeOffer(offer) {
    const inferred = extractKeywords(
      [offer.title, offer.description, ...(offer.skills || [])].join(" "),
    );
    offer = {
      ...offer,
      technologies: inferred.technologies,
      extractedKeywords: inferred,
      updatedAt: offer.updatedAt || offer.submittedAt || offer.firstRetrievedAt,
    };
    this.db
      .prepare(
        `INSERT INTO offers(id,company_id,canonical_url,fingerprint,title,city_key,region,domain,family,contract,published_at,expires_at,moderation,status,source_id,external_id,content_hash,payload)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,canonical_url=excluded.canonical_url,fingerprint=excluded.fingerprint,title=excluded.title,city_key=excluded.city_key,region=excluded.region,domain=excluded.domain,family=excluded.family,contract=excluded.contract,published_at=excluded.published_at,expires_at=excluded.expires_at,moderation=excluded.moderation,status=excluded.status,source_id=excluded.source_id,external_id=excluded.external_id,content_hash=excluded.content_hash,payload=excluded.payload`,
      )
      .run(
        offer.id,
        offer.company.id,
        canonicalUrl(offer.sourceUrl),
        fingerprint(offer),
        offer.title,
        searchText(offer.location.label),
        offer.location.region || "",
        offer.domain,
        groupOf(offer.domain) || "",
        offer.contract,
        publicationIndex(offer),
        Math.min(
          Date.parse(offer.expiresAt) + 86400000,
          offer.sourceExpiresAt ? Date.parse(offer.sourceExpiresAt) : Infinity,
        ),
        offer.moderationStatus,
        offer.status,
        offer.sourceId || null,
        offer.externalId || null,
        offer.contentHash || null,
        JSON.stringify(offer),
      );
    this.db
      .prepare("DELETE FROM offer_technologies WHERE offer_id=?")
      .run(offer.id);
    for (const tech of offer.technologies)
      this.db
        .prepare("INSERT INTO offer_technologies VALUES(?,?)")
        .run(offer.id, tech);
    this.db
      .prepare("DELETE FROM offer_education WHERE offer_id=?")
      .run(offer.id);
    for (const e of new Set(offer.education || []))
      this.db
        .prepare("INSERT INTO offer_education VALUES(?,?)")
        .run(offer.id, e);
    this.db
      .prepare("DELETE FROM offer_contracts WHERE offer_id=?")
      .run(offer.id);
    for (const contract of new Set(offer.acceptedContracts || [offer.contract]))
      this.db
        .prepare("INSERT INTO offer_contracts VALUES(?,?)")
        .run(offer.id, contract);
    this.db.prepare("DELETE FROM offer_search WHERE offer_id=?").run(offer.id);
    this.db
      .prepare("INSERT INTO offer_search(offer_id,document) VALUES(?,?)")
      .run(
        offer.id,
        [
          offer.title,
          offer.company.name,
          offer.description,
          offer.domain,
          offer.location.label,
        ].join(" "),
      );
    return offer;
  }
  async read() {
    return this.db
      .prepare("SELECT payload FROM offers ORDER BY rowid DESC")
      .all()
      .map(parse);
  }
  async submit(offer) {
    if (isBlockedSource(offer))
      throw new ValidationError("Les annonces Meteojob sont exclues.");
    try {
      return this.transaction(() => {
        this.writeOffer(offer);
        return { id: offer.id, status: "pending" };
      });
    } catch (e) {
      if (e.code === "ERR_SQLITE_ERROR" && /UNIQUE constraint/.test(e.message))
        throw new ValidationError("Cette annonce est déjà enregistrée.");
      throw e;
    }
  }
  async ingest(offer) {
    if (isBlockedSource(offer)) return "invalid";
    try {
      return this.transaction(() => {
        const row = this.db
          .prepare(
            "SELECT payload,content_hash FROM offers WHERE source_id=? AND external_id=?",
          )
          .get(offer.sourceId, offer.externalId);
        if (row?.content_hash === offer.contentHash) {
          const previous = parse(row);
          if (offer.lastFetchedAt > previous.lastFetchedAt) {
            this.writeOffer({
              ...previous,
              lastFetchedAt: offer.lastFetchedAt,
            });
          }
          return "unchanged";
        }
        const previous = row ? parse(row) : null;
        const suppressed =
          previous &&
          ["withdrawn", "rejected"].includes(previous.moderationStatus);
        offer = {
          ...offer,
          id: previous?.id || offer.id,
          firstRetrievedAt:
            previous?.firstRetrievedAt || offer.firstRetrievedAt,
          moderationStatus: suppressed
            ? previous.moderationStatus
            : offer.sourcePolicyApproved
              ? "approved"
              : "pending",
          status: suppressed ? "withdrawn" : "to_verify",
          lastVerifiedAt: null,
          technicalReviewAt: null,
        };
        this.writeOffer(offer);
        if (offer.moderationStatus === "approved")
          this.saveCompany(offer.company, null, []);
        return row ? "updated" : "created";
      });
    } catch (e) {
      if (/UNIQUE constraint/.test(e.message)) return "duplicate";
      throw e;
    }
  }
  auditPublicOffers(now = Date.now()) {
    return this.transaction(() => {
      const rows = this.db
        .prepare(
          "SELECT id,payload FROM offers WHERE moderation NOT IN ('withdrawn','rejected')",
        )
        .all();
      const audit = {
        checked: rows.length,
        withdrawn: 0,
        expired: 0,
        reasons: {},
        items: [],
      };
      for (const row of rows) {
        const offer = parse(row);
        if (offer.status === "expired" && !isBlockedSource(offer)) continue;
        const reasons =
          offer.moderationStatus === "approved"
            ? nonComplianceReasons(offer, now)
            : isBlockedSource(offer)
              ? ["blocked_source_meteojob"]
              : [];
        if (!reasons.length) continue;
        const expirationOnly = reasons.every((r) =>
          [
            "publication_outside_45_days",
            "local_expiration",
            "source_expiration",
          ].includes(r),
        );
        if (expirationOnly) {
          offer.status = "expired";
          audit.expired++;
        } else {
          offer.status = "withdrawn";
          offer.moderationStatus = "withdrawn";
          audit.withdrawn++;
        }
        offer.reviewNote =
          "Contrôle automatique de conformité : " + reasons.join(", ");
        this.db
          .prepare(
            "UPDATE offers SET moderation=?,status=?,payload=? WHERE id=?",
          )
          .run(
            offer.moderationStatus,
            offer.status,
            JSON.stringify(offer),
            row.id,
          );
        audit.items.push({ id: offer.id, reasons });
        for (const reason of reasons)
          audit.reasons[reason] = (audit.reasons[reason] || 0) + 1;
      }
      if (audit.withdrawn || audit.expired) {
        const date = new Date(now).toISOString();
        this.recordRun({
          sourceId: "catalogue-audit",
          startedAt: date,
          finishedAt: date,
          status: "success",
          created: 0,
          updated: audit.withdrawn + audit.expired,
          unchanged: 0,
          duplicate: 0,
          invalid: 0,
          audit,
          message: `Conformité : ${audit.withdrawn} annonce(s) retirée(s), ${audit.expired} expirée(s). Historique conservé en privé.`,
        });
      }
      return audit;
    });
  }
  publicConditions() {
    return {
      sql: `moderation='approved' AND status NOT IN ('expired','withdrawn') AND expires_at>? AND published_at>=? AND published_at<=? AND domain IN (${placeholders(domains)}) AND contract IN (${placeholders(contracts)})`,
      params: [
        Date.now(),
        publicationCutoff(),
        new Date().toISOString(),
        ...domains,
        ...contracts,
      ],
    };
  }
  async query(filters = {}) {
    this.freshCache();
    const key = "offers:" + JSON.stringify(filters),
      hit = this.cache.get(key);
    if (hit) {
      hit.offers = hit.offers
        .map((o) => publicOffer({ ...o, moderationStatus: "approved" }))
        .filter(Boolean);
      return hit;
    }
    const { sql, params } = this.publicConditions();
    const clauses = [sql],
      args = [...params];
    for (const [field, column] of [
      ["region", "region"],
      ["domain", "domain"],
      ["group", "family"],
      ["companyId", "company_id"],
    ])
      if (filters[field]) {
        clauses.push(`${column}=?`);
        args.push(String(filters[field]).slice(0, 200));
      }
    if (filters.contract) {
      clauses.push(
        "id IN (SELECT offer_id FROM offer_contracts WHERE contract=?)",
      );
      args.push(String(filters.contract).slice(0, 80));
    }
    if (filters.city) {
      const value = searchText(String(filters.city).slice(0, 120));
      clauses.push("city_key>=? AND city_key<?");
      args.push(value, value + "\uffff");
    }
    if (filters.tech) {
      clauses.push(
        "id IN (SELECT offer_id FROM offer_technologies WHERE technology=?)",
      );
      args.push(String(filters.tech).slice(0, 100));
    }
    if (filters.education) {
      clauses.push(
        "id IN (SELECT offer_id FROM offer_education WHERE education=?)",
      );
      args.push(String(filters.education).slice(0, 100));
    }
    if (filters.age) {
      const age = Number(filters.age);
      if (![1, 7, 14, 30].includes(age))
        throw new ValidationError("Filtre de date invalide.");
      clauses.push("published_at>=? AND published_at<=?");
      args.push(
        new Date(Date.now() - age * 86400000).toISOString().slice(0, 10),
        new Date().toISOString(),
      );
    }
    if (filters.query) {
      const terms =
        String(filters.query)
          .slice(0, 200)
          .match(/[\p{L}\p{N}]+/gu)
          ?.slice(0, 10) || [];
      if (terms.length) {
        clauses.push(
          "id IN (SELECT offer_id FROM offer_search WHERE offer_search MATCH ?)",
        );
        args.push(terms.map((t) => `"${t}"*`).join(" AND "));
      }
    }
    const where = clauses.join(" AND "),
      total = Number(
        this.db
          .prepare("SELECT count(*) AS n FROM offers WHERE " + where)
          .get(...args).n,
      );
    const pageSize = Math.min(
        50,
        Math.max(1, Math.trunc(Number(filters.pageSize) || 20)),
      ),
      pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(
      pages,
      Math.max(1, Math.trunc(Number(filters.page) || 1)),
    );
    const offers = this.db
      .prepare(
        "SELECT payload FROM offers WHERE " +
          where +
          " ORDER BY published_at DESC,id LIMIT ? OFFSET ?",
      )
      .all(...args, pageSize, (page - 1) * pageSize)
      .map(parse)
      .map((o) => publicOffer(o))
      .filter(Boolean)
      .map((o) => ({
        ...o,
        description: o.description?.slice(0, 240) || null,
        missions: [],
        skills: [],
        publicContacts: [],
        detailsComplete: false,
      }));
    const education = this.db
      .prepare(
        `SELECT DISTINCT education FROM offer_education WHERE offer_id IN (SELECT id FROM offers WHERE ${sql}) ORDER BY education`,
      )
      .all(...params)
      .map((r) => r.education);
    const tech = this.db
      .prepare(
        `SELECT DISTINCT technology FROM offer_technologies WHERE offer_id IN (SELECT id FROM offers WHERE ${sql}) ORDER BY technology`,
      )
      .all(...params)
      .map((r) => r.technology);
    const deadline = this.db
      .prepare("SELECT min(expires_at) AS expiry FROM offers WHERE " + where)
      .get(...args).expiry;
    return this.cache.set(
      key,
      {
        offers,
        total,
        page,
        pageSize,
        pages,
        facets: { education, technologies: tech },
      },
      Math.max(
        1,
        Math.min(15000, deadline ? Number(deadline) - Date.now() : 15000),
      ),
    );
  }
  async adminQuery(filters = {}) {
    const statuses = ["pending", "approved", "rejected", "withdrawn"];
    const status = statuses.includes(filters.moderation)
      ? filters.moderation
      : "pending";
    const counts = Object.fromEntries(
      this.db
        .prepare(
          "SELECT moderation,count(*) AS n FROM offers GROUP BY moderation",
        )
        .all()
        .map((r) => [r.moderation, Number(r.n)]),
    );
    const total = counts[status] || 0,
      pageSize = 20,
      pages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(
        pages,
        Math.max(1, Math.trunc(Number(filters.page) || 1)),
      );
    return {
      offers: this.db
        .prepare(
          "SELECT payload FROM offers WHERE moderation=? ORDER BY rowid DESC LIMIT ? OFFSET ?",
        )
        .all(status, pageSize, (page - 1) * pageSize)
        .map(parse),
      total,
      page,
      pageSize,
      pages,
      counts,
    };
  }
  async publicList() {
    return (await this.query({ pageSize: 50 })).offers;
  }
  async getPublic(id) {
    const row = this.db
      .prepare("SELECT payload FROM offers WHERE id=?")
      .get(id);
    return row ? publicOffer(parse(row)) : null;
  }
  async companies(filters = {}) {
    return this.companyCatalogue.list(filters);
  }
  async company(id) {
    return this.companyCatalogue.get(id);
  }
  async reviewCompany(id, body) {
    return this.companyCatalogue.review(id, body);
  }
  async review(id, body) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT payload FROM offers WHERE id=?")
        .get(id);
      if (!row) throw new ValidationError("Annonce introuvable.");
      const offer = parse(row);
      if (!["approve", "reject", "withdraw"].includes(body.action))
        throw new ValidationError("Action invalide.");
      if (body.action === "approve") {
        if (
          [
            "sourceChecked",
            "rightsChecked",
            "companyChecked",
            "contactChecked",
          ].some((k) => body[k] !== true)
        )
          throw new ValidationError(
            "Vérifiez la source, les droits, l’entreprise et les contacts avant de publier.",
          );
        if (!offer.publishedAt)
          throw new ValidationError(
            "Une date de publication source est nécessaire avant publication.",
          );
        if (
          (offer.sourceId === "serpapi-google-jobs"
            ? !isRecentPublication(offer.publishedAt)
            : Date.now() - Date.parse(offer.publishedAt) > 30 * 86400000) ||
          Date.parse(offer.expiresAt) + 86400000 <= Date.now()
        )
          throw new ValidationError("Annonce trop ancienne ou expirée.");
        if (nonComplianceReasons(offer).length)
          throw new ValidationError(
            "Cette annonce ne respecte pas les critères du catalogue (entreprise, domaine, contrat, lieu, source ou dates).",
          );
        offer.moderationStatus = "approved";
        offer.status = "active";
        offer.lastVerifiedAt = new Date().toISOString();
        offer.technicalReviewAt = offer.lastVerifiedAt;
        offer.source =
          offer.origin === "employer"
            ? "Dépôt direct de l’entreprise"
            : offer.sourceId === "employer-editorial"
              ? `Annonce employeur · ${offer.sourceName}`
              : offer.sourceId
                ? `Flux autorisé · ${offer.sourceName}`
                : "Site officiel de l’entreprise";
        this.saveCompany(
          offer.company,
          offer.lastVerifiedAt,
          offer.publicContacts,
        );
      } else {
        offer.moderationStatus =
          body.action === "reject" ? "rejected" : "withdrawn";
        offer.status = "withdrawn";
      }
      this.writeOffer(offer);
      return { id: offer.id, moderationStatus: offer.moderationStatus };
    });
  }
  recordRun(report) {
    this.db
      .prepare(
        "INSERT INTO ingestion_runs(source_id,started_at,finished_at,status,report) VALUES(?,?,?,?,?)",
      )
      .run(
        report.sourceId,
        report.startedAt,
        report.finishedAt,
        report.status,
        JSON.stringify(report),
      );
    this.db
      .prepare(
        "DELETE FROM ingestion_runs WHERE id NOT IN (SELECT id FROM ingestion_runs ORDER BY id DESC LIMIT 200)",
      )
      .run();
  }
  runs() {
    return this.db
      .prepare("SELECT report FROM ingestion_runs ORDER BY id DESC LIMIT 20")
      .all()
      .map((r) => JSON.parse(r.report));
  }
}
