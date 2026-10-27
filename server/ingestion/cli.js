import path from "node:path";
import { OfferStore } from "../store.js";
import { IngestionPipeline } from "./pipeline.js";
import { closeFeedConnections } from "./http.js";
const store = new OfferStore(process.env.DATA_DIR || path.resolve(".local"));
try {
  const result = await new IngestionPipeline(store).run();
  console.log(JSON.stringify(result, null, 2));
  if (result.reports.some((r) => r.status === "error")) process.exitCode = 1;
} catch {
  console.error(
    "Collecte interrompue : vérifier la configuration des sources.",
  );
  process.exitCode = 1;
} finally {
  store.close();
  await closeFeedConnections();
}
