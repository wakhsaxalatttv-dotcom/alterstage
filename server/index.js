import { importSerpApiOnce } from "./ingestion/serpapi-startup.js";
import { franceTravailConfiguration } from "./ingestion/france-travail.js";
import { seedBundledCatalogue } from "./ingestion/bundled.js";
import { createApp } from "./app.js";
import { closeFeedConnections } from "./ingestion/http.js";
const app = createApp(),
  port = Number(process.env.PORT || 3001);
console.info(app.locals.adminConfiguration.message);
const audit = app.locals.store.lastComplianceAudit;
console.info(
  `[Catalogue] Contrôle de conformité : ${audit.checked} annonce(s) contrôlée(s), ${audit.withdrawn} retirée(s), ${audit.expired} expirée(s).`,
);
await seedBundledCatalogue(app.locals.store);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`Offres Fraîches : serveur prêt sur le port ${port}`),
);
const serpApiStartupImport = importSerpApiOnce({
  store: app.locals.store,
  probe: app.locals.serpApiProbe,
  inbox: app.locals.serpApiInbox,
  enabled: process.env.SERPAPI_STARTUP_IMPORT !== "false",
})
  .then((result) => {
    console.info(
      `[Google Jobs] ${result.status} : ${result.imported?.created || 0} résultat(s) importé(s) en privé, ${result.imported?.excluded || 0} exclu(s). Aucune publication sans contrôle des dates et critères.`,
    );
  })
  .catch(() =>
    console.error(
      "[Google Jobs] Import indisponible. Consulter l’espace privé.",
    ),
  );
const ft = franceTravailConfiguration();
console.info(
  `[France Travail] ${!ft.enabled ? "Collecte désactivée." : ft.configured ? "Identifiants présents ; connexion API à tester par la collecte." : "Source non configurée : identifiant client ou secret absent."}`,
);
const minutes = Number(
  process.env.INGEST_INTERVAL_MINUTES ||
    (process.env.LBA_API_KEY || (ft.configured && ft.enabled) ? 180 : 0),
);
const run = () =>
  app.locals.pipeline
    .run()
    .then((result) => {
      for (const report of result.reports)
        if (report.sourceId === "france-travail")
          console.info(
            `[France Travail] ${report.status} : ${report.created} nouvelle(s), ${report.updated} modifiée(s), ${report.invalid} invalide(s). ${report.coverage ? `Métiers parcourus : ${report.coverage.completedRomeCodes}/${report.coverage.totalRomeCodes}. ` : ""}${report.message || ""}`,
          );
    })
    .catch(() =>
      console.error(
        "Collecte indisponible : vérifier la configuration des sources.",
      ),
    );
if (
  (process.env.LBA_API_KEY && process.env.LBA_ENABLED !== "false") ||
  (ft.configured && ft.enabled)
)
  run();
const timer = minutes >= 5 ? setInterval(run, minutes * 60000) : null;
timer?.unref();
async function shutdown() {
  if (timer) clearInterval(timer);
  server.close(async () => {
    if (app.locals.pipeline.running)
      await app.locals.pipeline.running.catch(() => {});
    await serpApiStartupImport;
    await closeFeedConnections();
    app.locals.store.close();
    process.exit(0);
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
