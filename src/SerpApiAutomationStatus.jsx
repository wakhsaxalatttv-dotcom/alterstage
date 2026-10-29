import React, { useEffect, useState } from "react";
import { request } from "./api";
export function SerpApiAutomationStatus({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      request("/api/admin/serpapi/automation", { token })
        .then((value) => {
          if (active) {
            setData(value);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  return (
    <section className="rapidapi-probe" aria-labelledby="serpapi-auto-title">
      <h3 id="serpapi-auto-title">Google Jobs — actualisation automatique</h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p>Chargement du suivi…</p>
      ) : (
        <>
          <p>
            {!data.configured
              ? "Google Jobs : clé serveur absente."
              : data.enabled
                ? "Les recherches, l’analyse et la publication des offres admissibles fonctionnent sans intervention."
                : "Actualisation désactivée sur le serveur."}
          </p>
          <p>
            {data.completedSearches} / {data.totalSearches} recherches
            effectuées dans les {data.refreshDays} derniers jours, sur{" "}
            {data.completedDomains} / {data.totalDomains} domaines.
          </p>
          <p className="muted">
            {data.usedToday} / {data.dailyLimit} appels automatiques utilisés
            aujourd’hui. La rotation est échelonnée, dans la limite du quota
            fournisseur. Meteojob est exclu.
          </p>
          {data.state && (
            <div className="local-note" role="status">
              <p>Dernière recherche : {data.state.query}.</p>
              <p>
                {data.state.published} offre(s) admissible(s) au catalogue,{" "}
                {data.state.deferred} résultat(s) incomplet(s) non publié(s),{" "}
                {data.state.excluded} exclu(s).
              </p>
              {data.state.pauseUntil > Date.now() && (
                <p>
                  Collecte temporairement suspendue après une erreur ou une
                  limite fournisseur. Reprise automatique après le{" "}
                  {new Date(data.state.pauseUntil).toLocaleString("fr-FR")}.
                </p>
              )}
              {Object.keys(data.state.reasons || {}).length > 0 && (
                <details>
                  <summary>Motifs de non-publication</summary>
                  <ul>
                    {Object.entries(data.state.reasons).map(
                      ([reason, count]) => (
                        <li key={reason}>
                          {{
                            publication_missing_or_outside_45_days:
                              "Date source absente ou hors des 45 jours",
                            technical_domain_not_established:
                              "Domaine technique non établi",
                            contract_not_established:
                              "Type de contrat non précisé",
                            french_location_not_established:
                              "Localisation française non établie",
                            meteojob: "Provenance Meteojob",
                            ineligible_source_record:
                              "Annonce incomplète ou hors périmètre",
                            editorial_decision_preserved:
                              "Décision de modération conservée",
                            normalization_failed:
                              "Données incompatibles avec le catalogue",
                            non_technical_role:
                              "Métier hors périmètre technique",
                          }[reason] || reason}{" "}
                          : {count}
                        </li>
                      ),
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
