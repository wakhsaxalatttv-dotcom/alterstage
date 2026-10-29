import { SerpApiInbox } from "./SerpApiInbox";
import React, { useEffect, useState } from "react";
import { request } from "./api";
export function SerpApiProbe({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request("/api/admin/serpapi", { token })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function test() {
    setBusy(true);
    setError("");
    try {
      const latest = await request("/api/admin/serpapi/test", {
        token,
        method: "POST",
        body: "{}",
      });
      setData((previous) => ({ ...previous, latest }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rapidapi-probe" aria-labelledby="serpapi-title">
      <h3 id="serpapi-title">SerpApi · Google Jobs</h3>
      <p>
        {data
          ? data.configured
            ? "Clé serveur présente. Un test permet de vérifier la connexion et le format des résultats."
            : "Source non configurée : ajouter SERPAPI_API_KEY dans les variables d’environnement Render."
          : "Vérification de la configuration…"}
      </p>
      <p className="muted">
        Le bouton effectue un appel de votre quota SerpApi, sans publication
        d’annonce ni affichage de clé. Aucun test automatique au démarrage.
      </p>
      <button
        className="secondary"
        onClick={test}
        disabled={busy || !data?.configured}
      >
        {busy ? "Test en cours…" : "Tester SerpApi"}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {data?.latest && (
        <div role="status" className="local-note rapidapi-result">
          <p>
            {data.latest.httpStatus ? `HTTP ${data.latest.httpStatus} · ` : ""}
            {data.latest.message}
          </p>
          {Number.isInteger(data.latest.resultCount) && (
            <p>
              {data.latest.resultCount} résultat(s) reçu(s), dont{" "}
              {data.latest.withApplicationLinks} avec lien de candidature. Ce
              nombre ne représente pas les offres éligibles au site.
            </p>
          )}
          {data.latest.shape && (
            <details>
              <summary>
                Afficher la structure à transmettre pour finaliser le connecteur
              </summary>
              <pre>{JSON.stringify(data.latest.shape, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      <SerpApiInbox token={token} configured={data?.configured} />
    </section>
  );
}
