import { SERPAPI_SEARCHES } from "../../shared/serpapi-searches.js";
const HOUR = 3600000,
  DAY = 86400000;
const bounded = (value, fallback, min, max) =>
  Number.isFinite(Number(value)) && String(value).trim() !== ""
    ? Math.max(min, Math.min(max, Math.floor(Number(value))))
    : fallback;
export class SerpApiAutomation {
  constructor({
    store,
    probe,
    inbox,
    resolveLocation,
    env = process.env,
    now = Date.now,
  }) {
    Object.assign(this, { store, probe, inbox, resolveLocation, env, now });
    this.running = null;
    this.dailyLimit = bounded(env.SERPAPI_DAILY_REQUEST_LIMIT, 24, 1, 200);
    this.refreshDays = bounded(env.SERPAPI_REFRESH_DAYS, 7, 1, 30);
    store.db.exec(
      `CREATE TABLE IF NOT EXISTS serpapi_schedule(id TEXT PRIMARY KEY,query TEXT NOT NULL,domain TEXT NOT NULL,last_attempt INTEGER,last_success INTEGER); CREATE TABLE IF NOT EXISTS serpapi_auto_requests(id INTEGER PRIMARY KEY,started_at INTEGER NOT NULL,query_id TEXT NOT NULL,status TEXT NOT NULL); CREATE INDEX IF NOT EXISTS serpapi_auto_requests_time ON serpapi_auto_requests(started_at);`,
    );
    store.transaction(() => {
      const upsert = store.db.prepare(
        "INSERT INTO serpapi_schedule(id,query,domain) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET query=excluded.query,domain=excluded.domain",
      );
      for (const search of SERPAPI_SEARCHES)
        upsert.run(search.id, search.query, search.domain);
      store.db
        .prepare(
          `DELETE FROM serpapi_schedule WHERE id NOT IN (${SERPAPI_SEARCHES.map(() => "?").join(",")})`,
        )
        .run(...SERPAPI_SEARCHES.map((s) => s.id));
    });
  }
  get enabled() {
    return this.env.SERPAPI_AUTO_ENABLED !== "false" && this.probe.configured();
  }
  status() {
    const time = this.now(),
      today = Date.parse(new Date(time).toISOString().slice(0, 10));
    const state = this.store.db
      .prepare("SELECT value FROM metadata WHERE key='serpapi-auto-state'")
      .get();
    const recent = this.store.db
      .prepare(
        "SELECT count(*) AS searches,count(DISTINCT domain) AS domains FROM serpapi_schedule WHERE last_success>=?",
      )
      .get(time - this.refreshDays * DAY);
    const used = this.store.db
      .prepare(
        "SELECT count(*) AS n FROM serpapi_auto_requests WHERE started_at>=?",
      )
      .get(today).n;
    return {
      configured: this.probe.configured(),
      enabled: this.enabled,
      running: !!this.running,
      totalSearches: SERPAPI_SEARCHES.length,
      totalDomains: new Set(SERPAPI_SEARCHES.map((s) => s.domain)).size,
      completedSearches: recent.searches,
      completedDomains: recent.domains,
      dailyLimit: this.dailyLimit,
      usedToday: used,
      refreshDays: this.refreshDays,
      state: state ? JSON.parse(state.value) : null,
    };
  }
  tick() {
    if (!this.running)
      this.running = this.execute().finally(() => {
        this.running = null;
      });
    return this.running;
  }
  async execute() {
    if (!this.enabled) return { status: "disabled" };
    const time = this.now(),
      today = Date.parse(new Date(time).toISOString().slice(0, 10));
    const claim = this.store.transaction(() => {
      const state = this.store.db
        .prepare("SELECT value FROM metadata WHERE key='serpapi-auto-state'")
        .get();
      if (state && JSON.parse(state.value).pauseUntil > time) return null;
      // Persistent budget and a global lease also cover multiple instances sharing this database.
      const budget = this.store.db
        .prepare(
          "SELECT count(*) AS n FROM serpapi_auto_requests WHERE started_at>=?",
        )
        .get(today).n;
      const hourly = this.store.db
        .prepare(
          "SELECT count(*) AS n FROM serpapi_auto_requests WHERE started_at>?",
        )
        .get(time - HOUR).n;
      const lease = this.store.db
        .prepare(
          "SELECT started_at FROM serpapi_auto_requests WHERE status='running' AND started_at>? LIMIT 1",
        )
        .get(time - 120000);
      if (budget >= this.dailyLimit || hourly >= 3 || lease) return null;
      const last = this.store.db
        .prepare("SELECT max(started_at) AS t FROM serpapi_auto_requests")
        .get().t;
      if (last !== null && time - last < 20 * 60000) return null;
      const search = this.store.db
        .prepare(
          "SELECT * FROM serpapi_schedule WHERE last_success IS NULL OR last_success<? ORDER BY last_attempt IS NOT NULL,last_attempt,id LIMIT 1",
        )
        .get(time - this.refreshDays * DAY);
      if (!search) return null;
      const row = this.store.db
        .prepare(
          "INSERT INTO serpapi_auto_requests(started_at,query_id,status) VALUES(?,?,'running')",
        )
        .run(time, search.id);
      this.store.db
        .prepare("UPDATE serpapi_schedule SET last_attempt=? WHERE id=?")
        .run(time, search.id);
      return { search, requestId: row.lastInsertRowid };
    });
    if (!claim) return { status: "waiting" };
    let result;
    try {
      result = await this.probe.run({
        query: claim.search.query,
        onResults: (jobs) =>
          this.inbox.ingestAutomatically(jobs, this.resolveLocation),
      });
    } catch {
      result = {
        status: "error",
        message:
          "Collecte Google Jobs interrompue ; une nouvelle tentative sera planifiée.",
      };
    }
    const finishedAt = new Date(this.now()).toISOString();
    const report = result.imported || {};
    const pauseUntil =
      result.status === "success"
        ? 0
        : time +
          (result.httpStatus === 429
            ? DAY
            : [401, 403].includes(result.httpStatus)
              ? 6 * HOUR
              : HOUR);
    this.store.transaction(() => {
      this.store.db
        .prepare("UPDATE serpapi_auto_requests SET status=? WHERE id=?")
        .run(result.status, claim.requestId);
      if (result.status === "success")
        this.store.db
          .prepare("UPDATE serpapi_schedule SET last_success=? WHERE id=?")
          .run(time, claim.search.id);
      const state = {
        lastRunAt: finishedAt,
        query: claim.search.query,
        domain: claim.search.domain,
        status: result.status,
        pauseUntil,
        published: report.published || 0,
        deferred: report.deferred || 0,
        excluded: report.excluded || 0,
        reasons: report.reasons || {},
      };
      this.store.db
        .prepare(
          "INSERT INTO metadata(key,value) VALUES('serpapi-auto-state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(JSON.stringify(state));
      this.store.recordRun({
        sourceId: "serpapi-automatic",
        startedAt: new Date(time).toISOString(),
        finishedAt,
        status: result.status,
        created: report.created || 0,
        updated: report.updated || 0,
        unchanged: report.unchanged || 0,
        duplicate: report.duplicate || 0,
        invalid: report.excluded || 0,
        analysis: state,
        message:
          result.status === "success"
            ? `${claim.search.domain} : ${report.published || 0} offre(s) éligible(s) dans le catalogue ; ${report.deferred || 0} résultat(s) incomplet(s) non publié(s), ${report.excluded || 0} exclu(s).`
            : result.message || "Source momentanément indisponible.",
      });
      this.store.db
        .prepare("DELETE FROM serpapi_auto_requests WHERE started_at<?")
        .run(time - 35 * DAY);
    });
    this.store.auditPublicOffers();
    return { status: result.status, report };
  }
  start() {
    if (this.timer) return;
    const tick = () =>
      this.tick()
        .then((result) => {
          if (!["waiting", "disabled"].includes(result.status))
            console.info(
              `[Google Jobs] Collecte automatique : ${result.status}, ${result.report?.published || 0} offre(s) éligible(s).`,
            );
        })
        .catch(() =>
          console.error("[Google Jobs] Collecte automatique indisponible."),
        );
    tick();
    this.timer = setInterval(tick, 60000);
    this.timer.unref();
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.running) await this.running.catch(() => {});
  }
}
