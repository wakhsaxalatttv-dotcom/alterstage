import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
const folder = path.resolve('.local');
const file = path.join(folder, 'retrieval-history.json');
export async function retainFirstRetrieval(offers) {
  let history = {};
  try { history = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Historique des récupérations illisible ; arrêt pour ne pas réinventer les dates.'); }
  for (const offer of offers) {
    if (!history[offer.id]) history[offer.id] = offer.firstRetrievedAt;
    offer.firstRetrievedAt = history[offer.id];
  }
  await mkdir(folder, {recursive:true});
  await writeFile(file + '.tmp', JSON.stringify(history), {mode:0o600});
  await rename(file + '.tmp', file);
}
