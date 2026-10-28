PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL,
 type TEXT, size TEXT, city_key TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE INDEX IF NOT EXISTS company_name ON companies(name_key);
CREATE INDEX IF NOT EXISTS company_segment ON companies(type,size);
CREATE INDEX IF NOT EXISTS company_city ON companies(city_key);
CREATE TABLE IF NOT EXISTS offers (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL, canonical_url TEXT NOT NULL, fingerprint TEXT NOT NULL,
 title TEXT NOT NULL, city_key TEXT NOT NULL, region TEXT NOT NULL, domain TEXT NOT NULL, family TEXT NOT NULL,
 contract TEXT NOT NULL, published_at TEXT, expires_at INTEGER NOT NULL,
 moderation TEXT NOT NULL CHECK(moderation IN ('pending','approved','rejected','withdrawn')),
 status TEXT NOT NULL, source_id TEXT, external_id TEXT, content_hash TEXT,
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE UNIQUE INDEX IF NOT EXISTS offer_url ON offers(canonical_url) WHERE moderation != 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS offer_fingerprint ON offers(fingerprint) WHERE moderation != 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS source_identity ON offers(source_id, external_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS offer_publication ON offers(moderation,published_at DESC,id);
CREATE INDEX IF NOT EXISTS offer_region_contract ON offers(moderation,region,contract,published_at DESC);
CREATE INDEX IF NOT EXISTS offer_city ON offers(moderation,city_key,published_at DESC);
CREATE INDEX IF NOT EXISTS offer_domain ON offers(moderation,domain,published_at DESC);
CREATE INDEX IF NOT EXISTS offer_company ON offers(company_id,moderation,published_at DESC);
CREATE TABLE IF NOT EXISTS offer_technologies (
 offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE, technology TEXT NOT NULL,
 PRIMARY KEY(offer_id,technology)
);
CREATE INDEX IF NOT EXISTS technology_lookup ON offer_technologies(technology,offer_id);
CREATE TABLE IF NOT EXISTS offer_education (
 offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE, education TEXT NOT NULL,
 PRIMARY KEY(offer_id,education)
);
CREATE INDEX IF NOT EXISTS education_lookup ON offer_education(education,offer_id);
CREATE VIRTUAL TABLE IF NOT EXISTS offer_search USING fts5(offer_id UNINDEXED, document, tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS ingestion_runs (
 id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
 status TEXT NOT NULL, report TEXT NOT NULL CHECK(json_valid(report))
);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
PRAGMA user_version=1;
CREATE TABLE IF NOT EXISTS offer_contracts (
 offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE, contract TEXT NOT NULL,
 PRIMARY KEY(offer_id,contract)
);
CREATE INDEX IF NOT EXISTS contract_lookup ON offer_contracts(contract,offer_id);
INSERT OR IGNORE INTO offer_contracts(offer_id,contract) SELECT id,contract FROM offers;
CREATE TABLE IF NOT EXISTS offer_reports (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, target_kind TEXT NOT NULL CHECK(target_kind IN ('catalogue','reference')),
 reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 created_at TEXT NOT NULL, reviewed_at TEXT, review_note TEXT NOT NULL DEFAULT '', last_action TEXT,
 offer_snapshot TEXT NOT NULL CHECK(json_valid(offer_snapshot))
);
CREATE INDEX IF NOT EXISTS reports_status_date ON offer_reports(status,created_at DESC,id);
CREATE TABLE IF NOT EXISTS hidden_references (
 id TEXT PRIMARY KEY, hidden_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT ''
);
