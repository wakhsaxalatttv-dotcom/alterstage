// One durable claim per database prevents repeated quota consumption across redeploys/workers.
const TASK_KEY = "serpapi-import-request-meteojob-exclusion-v1";
export async function importSerpApiOnce({
  store,
  probe,
  inbox,
  enabled = true,
}) {
  if (!enabled || !probe.configured()) return { status: "not_configured" };
  const startedAt = new Date().toISOString();
  const claimed = store.transaction(
    () =>
      store.db
        .prepare("INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)")
        .run(TASK_KEY, JSON.stringify({ status: "running", startedAt }))
        .changes,
  );
  if (!claimed) return { status: "already_attempted" };
  let result;
  try {
    result = await probe.run({ onResults: (jobs) => inbox.stage(jobs) });
  } catch {
    result = {
      status: "error",
      message:
        "Import Google Jobs indisponible. Réessayer depuis l’espace privé.",
    };
  }
  const finishedAt = new Date().toISOString();
  store.transaction(() => {
    store.db
      .prepare("UPDATE metadata SET value=? WHERE key=?")
      .run(
        JSON.stringify({ status: result.status, startedAt, finishedAt }),
        TASK_KEY,
      );
    store.recordRun({
      sourceId: "serpapi-import-startup",
      startedAt,
      finishedAt,
      status: result.status,
      created: result.imported?.created || 0,
      duplicate: result.imported?.duplicate || 0,
      updated: 0,
      unchanged: 0,
      invalid: result.imported?.excluded || 0,
      message:
        result.message ||
        "Import non effectué. Consulter la configuration privée.",
    });
  });
  return result;
}
