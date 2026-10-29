import { dispatcher } from "./http.js";
export const RAPIDAPI_LINKEDIN_HOST =
  "fresh-linkedin-job-search-data.p.rapidapi.com";
export const RAPIDAPI_LINKEDIN_URL = `https://${RAPIDAPI_LINKEDIN_HOST}/job-search`;
export const rapidApiConfigured = (env = process.env) =>
  Boolean(env.RAPIDAPI_LINKEDIN_KEY?.trim());
const privateField =
  /email|phone|telephone|mobile|recruiter|contact|poster|author|token|secret|api.?key|authorization/i;
// Return field names and types only, never recruiter details, response strings or credentials.
export function responseShape(value, secret = "") {
  let remaining = 200;
  function shape(item, depth) {
    if (--remaining < 0 || depth > 6) return "structure abrégée";
    if (item === null) return "null";
    if (Array.isArray(item))
      return {
        type: "array",
        length: item.length,
        first: item.length ? shape(item[0], depth + 1) : null,
      };
    if (typeof item === "object") {
      const fields = Object.create(null);
      for (const name of Object.keys(item).slice(0, 40)) {
        if (remaining <= 0) {
          fields.structure = "abrégée";
          break;
        }
        if (
          !/^[\w -]{1,80}$/.test(name) ||
          privateField.test(name) ||
          (secret && name.includes(secret))
        )
          continue;
        fields[name] = shape(item[name], depth + 1);
      }
      return fields;
    }
    if (typeof item === "string") {
      if (/^https:\/\//.test(item)) return "string (URL HTTPS)";
      if (
        /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(item) &&
        Number.isFinite(Date.parse(item))
      )
        return "string (date ISO)";
      return "string";
    }
    return typeof item;
  }
  return shape(value, 0);
}
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
export function createRapidApiProbe({
  env = process.env,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  let running = false,
    lastStarted = null,
    hourStart = now(),
    calls = 0;
  return {
    configured: () => rapidApiConfigured(env),
    async run() {
      if (!rapidApiConfigured(env))
        return {
          status: "not_configured",
          message:
            "Ajouter RAPIDAPI_LINKEDIN_KEY dans les variables d’environnement Render.",
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
      const key = env.RAPIDAPI_LINKEDIN_KEY.trim();
      const url = new URL(RAPIDAPI_LINKEDIN_URL);
      url.search = new URLSearchParams({
        search: "alternance informatique",
        location: "France",
        sortBy: "date",
        page: "1",
      });
      try {
        const response = await fetcher(url.href, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "x-rapidapi-host": RAPIDAPI_LINKEDIN_HOST,
            "x-rapidapi-key": key,
          },
          dispatcher,
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          const messages = {
            401: "Clé RapidAPI refusée : vérifier la clé et l’application associée.",
            403: "Accès RapidAPI refusé : vérifier la clé et l’abonnement à cette API.",
            429: "Quota RapidAPI atteint. Attendre le renouvellement du quota ou vérifier la formule.",
          };
          return {
            status: "error",
            httpStatus: response.status,
            message:
              messages[response.status] ||
              "L’API n’a pas accepté le test. Vérifier sa disponibilité et les paramètres dans RapidAPI.",
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
        return {
          status: "success",
          httpStatus: response.status,
          checkedAt: new Date(now()).toISOString(),
          shape: responseShape(data, key),
          message:
            "Réponse API reçue. Seule la structure est conservée ; aucune annonce importée. Le format et les droits de réutilisation restent à valider.",
        };
      } catch {
        return {
          status: "error",
          message:
            "Connexion RapidAPI indisponible ou délai dépassé. Vérifier la sortie réseau du serveur.",
        };
      } finally {
        running = false;
      }
    },
  };
}
