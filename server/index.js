import express from 'express';
import { franceTravail } from './france-travail.js';
import path from 'node:path';
import { retainFirstRetrieval } from './history.js';
const app = express();
let cache, expires = 0, pending;
app.get('/api/offers', async (_req, res) => {
  try {
    if (!cache || Date.now() > expires) {
      pending ||= franceTravail.load().then(async result => {
        if (result.status === 'connected') await retainFirstRetrieval(result.offers);
        return result;
      }).finally(() => { pending = null; });
      cache = await pending; expires = Date.now() + 5 * 60 * 1000;
    }
    res.set('Cache-Control','no-store').json({...cache, sources:[{id:franceTravail.id, name:'France Travail', status:cache.status}]});
  } catch (error) {
    console.error(error.message);
    res.status(502).json({status:'error', offers:[], message:'La source France Travail est temporairement inaccessible. Réessayez plus tard. Aucun résultat ancien n’est présenté comme actuel.'});
  }
});
app.use(express.static(path.resolve('dist')));
app.get('/{*path}', (_req,res) => res.sendFile(path.resolve('dist/index.html')));
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Offres Fraîches : serveur prêt sur le port ' + (process.env.PORT || 3001)));
