import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { OfferStore } from '../server/store.js';
import { IngestionPipeline } from '../server/ingestion/pipeline.js';
import { auditAvailability } from '../server/ingestion/availability.js';
import { closeFeedConnections } from '../server/ingestion/http.js';
const folder = process.env.DATA_DIR || path.resolve('.local');
const store = new OfferStore(folder);
try {
  const startedAt = new Date().toISOString();
  const before = await store.query();
  const collection = await new IngestionPipeline(store).run();
  const availability = await auditAvailability(store);
  store.cache.clear();
  const after = await store.query();
  const report = {
    startedAt, finishedAt: new Date().toISOString(),
    deployment: 'local-only', publicBefore: before.total, publicAfter: after.total,
    compliance: store.lastComplianceAudit,
    collection: collection.reports.map(({ sourceId, status, created, updated, invalid, message }) => ({ sourceId, status, created, updated, invalid, message })),
    availability,
    notice: 'Aucun état de production Render déduit de cet audit local. Une page inaccessible ne prouve ni ouverture ni clôture.',
  };
  // Private, ignored by Git; never store response bodies, API credentials or contacts.
  await writeFile(path.join(folder, 'maintenance-last.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
} finally { store.close(); await closeFeedConnections(); }
