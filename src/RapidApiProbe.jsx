import React, { useEffect, useState } from "react";
import { request } from "./api";
export function RapidApiProbe({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request("/api/admin/rapidapi-linkedin", { token })
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
      const latest = await request("/api/admin/rapidapi-linkedin/test", {
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
    <section className="rapidapi-probe" aria-labelledby="rapidapi-title">
      <h3 id="rapidapi-title">RapidAPI · LinkedIn</h3>
      <p>
        {data
          ? data.configured
            ? "Clé serveur présente. Un test permet de vérifier la connexion et le format des résultats."
            : "Source non configurée : ajouter RAPIDAPI_LINKEDIN_KEY dans les variables d’environnement Render."
          : "Vérification de la configuration…"}
      </p>
      <p className="muted">
        Le bouton effectue un appel de votre quota RapidAPI, sans publication
        d’annonce ni affichage de clé. Aucun test automatique au démarrage.
      </p>
      <button
        className="secondary"
        onClick={test}
        disabled={busy || !data?.configured}
      >
        {busy ? "Test en cours…" : "Tester RapidAPI"}
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
    </section>
  );
}
