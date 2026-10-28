import { seedBundledCatalogue } from "./ingestion/bundled.js";
import { createApp } from "./app.js";
import { closeFeedConnections } from "./ingestion/http.js";
const app = createApp(),
  port = Number(process.env.PORT || 3001);
console.info(app.locals.adminConfiguration.message);
await seedBundledCatalogue(app.locals.store);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`Offres Fraîches : serveur prêt sur le port ${port}`),
);
const minutes = Number(
  process.env.INGEST_INTERVAL_MINUTES || (process.env.LBA_API_KEY ? 180 : 0),
);
const run = () =>
  app.locals.pipeline
    .run()
    .catch(() =>
      console.error(
        "Collecte indisponible : vérifier la configuration des sources.",
      ),
    );
if (process.env.LBA_API_KEY && process.env.LBA_ENABLED !== "false") run();
const timer = minutes >= 5 ? setInterval(run, minutes * 60000) : null;
timer?.unref();
async function shutdown() {
  if (timer) clearInterval(timer);
  server.close(async () => {
    if (app.locals.pipeline.running)
      await app.locals.pipeline.running.catch(() => {});
    await closeFeedConnections();
    app.locals.store.close();
    process.exit(0);
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
