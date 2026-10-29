import { responseShape } from "./rapidapi-linkedin.js";
import { dispatcher } from "./http.js";
export const SERPAPI_URL = "https://serpapi.com/search.json";
export const serpApiConfigured = (env = process.env) =>
  Boolean(env.SERPAPI_API_KEY?.trim());
async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2 * 1024 * 1024) throw new Error("size");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function createSerpApiProbe({
  env = process.env,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  let running = false,
    lastStarted = null,
    hourStart = now(),
    calls = 0;
  return {
    configured: () => serpApiConfigured(env),
    async run() {
      if (!serpApiConfigured(env))
        return {
          status: "not_configured",
          message:
            "Ajouter SERPAPI_API_KEY dans les variables d’environnement Render.",
        };
      const time = now();
      if (time - hourStart >= 3600000) {
        hourStart = time;
        calls = 0;
      }
      if (
        running ||
        (lastStarted !== null && time - lastStarted < 60000) ||
        calls >= 3
      )
        return {
          status: "limited",
          message:
            "Test déjà en cours ou limite atteinte : attendre une minute entre deux essais, maximum trois essais par heure sur cette instance.",
        };
      running = true;
      lastStarted = time;
      calls++;
      const key = env.SERPAPI_API_KEY.trim();
      const url = new URL(SERPAPI_URL);
      url.search = new URLSearchParams({
        engine: "google_jobs",
        q: "alternance informatique",
        location: "France",
        hl: "fr",
        gl: "fr",
        api_key: key,
      });
      try {
        const response = await fetcher(url.href, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          dispatcher,
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          const messages = {
            401: "Clé SerpApi refusée : vérifier la clé et le compte associé.",
            403: "Accès SerpApi refusé : vérifier la clé et l’abonnement à cette API.",
            429: "Quota SerpApi atteint. Attendre le renouvellement du quota ou vérifier la formule.",
          };
          return {
            status: "error",
            httpStatus: response.status,
            message:
              messages[response.status] ||
              "L’API n’a pas accepté le test. Vérifier sa disponibilité et les paramètres dans SerpApi.",
          };
        }
        if (!/json/i.test(response.headers.get("content-type") || "")) {
          await response.body?.cancel().catch(() => {});
          return {
            status: "error",
            httpStatus: response.status,
            message:
              "Réponse non JSON : aucun format d’annonce n’a été supposé.",
          };
        }
        let data;
        try {
          data = await readJson(response);
        } catch {
          return {
            status: "error",
            httpStatus: response.status,
            message:
              "Réponse illisible, interrompue ou trop volumineuse. Aucun contenu n’a été enregistré.",
          };
        }
        if (!data || typeof data !== "object")
          return {
            status: "error",
            httpStatus: response.status,
            message: "Format de réponse inattendu : aucune annonce importée.",
          };
        if (data.error || (!Array.isArray(data.jobs_results) && data.search_information?.jobs_results_state !== "Fully empty"))
          return {
            status: "error",
            httpStatus: response.status,
            message: "Réponse SerpApi en erreur ou format Google Jobs inattendu. Aucune annonce importée.",
          };
        const jobs = Array.isArray(data.jobs_results) ? data.jobs_results : [];
        return {
          resultCount: jobs.length,
          withApplicationLinks: jobs.filter(j => Array.isArray(j.apply_options) && j.apply_options.some(o => typeof o.link === "string" && o.link.startsWith("https://"))).length,
          status: "success",
          httpStatus: response.status,
          checkedAt: new Date(now()).toISOString(),
          shape: responseShape({ jobs_results: jobs }, key),
          message:
            "Réponse API reçue. Résultats comptés et structure contrôlée ; aucune annonce importée. Les critères, dates et droits de réutilisation restent à valider.",
        };
      } catch {
        return {
          status: "error",
          message:
            "Connexion SerpApi indisponible ou délai dépassé. Vérifier la sortie réseau du serveur.",
        };
      } finally {
        running = false;
      }
    },
  };
}
