import { normalizeOffer, deduplicate } from './domain.js';
/** Source connector contract: { id, load(): Promise<{status, offers, message, retrievedAt?}> }. */
export const franceTravail = {
  id: 'france-travail',
  async load() {
    const id = process.env.FRANCE_TRAVAIL_CLIENT_ID, secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
    if (!id || !secret) return {status:'unconfigured', offers:[], message:'Source non configurée : les identifiants France Travail sont absents.'};
    const request = async (url, options = {}) => {
      const response = await fetch(url, {...options, signal: AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error(`France Travail : réponse HTTP ${response.status}`);
      return response.status === 204 ? {} : response.json();
    };
    const auth = await request('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'client_credentials', client_id:id, client_secret:secret, scope:'api_offresdemploiv2 o2dsoffre'})
    });
    if (!auth.access_token) throw new Error('Authentification France Travail indisponible');
    const retrievedAt = new Date().toISOString();
    const batches = await Promise.all(['E1','E2','FS'].map(typeContrat => request(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?typeContrat=${typeContrat}&sort=0&range=0-149`, {headers:{Authorization:`Bearer ${auth.access_token}`}})));
    const offers = deduplicate(batches.flatMap(b => (b.resultats || []).map(o => normalizeOffer(o, retrievedAt)).filter(Boolean)));
    return {status:'connected', offers, retrievedAt, message:'Sélection des dernières offres renvoyées par l’API (150 maximum par type de contrat). Réception via API, disponibilité à confirmer auprès de l’entreprise.'};
  }
};
