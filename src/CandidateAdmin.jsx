import React, { useEffect, useState } from "react";
import { request } from "./api";
import "./candidate.css";
export function CandidateAdmin({ token }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [rev, setRev] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    request("/api/admin/candidates", { token })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, rev]);
  return (
    <section className="candidate-panel">
      <h2>Audience et comptes candidats</h2>
      <button className="secondary" onClick={() => setRev((n) => n + 1)}>
        Actualiser les statistiques
      </button>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>Chargement…</p>
      ) : (
        <>
          <p>
            Comptes{" "}
            {data.configuration.enabled
              ? "activés"
              : "non activés ou indisponibles"}{" "}
            · Inscriptions{" "}
            {data.configuration.registrationEnabled
              ? "ouvertes"
              : "indisponibles"}{" "}
            · Alertes e-mail{" "}
            {data.configuration.emailAlertsEnabled
              ? "configurées"
              : "non configurées"}
          </p>
          {!data.stats ? (
            <p>
              Les statistiques privées nécessitent la migration Supabase,
              l’activation des comptes et une clé serveur configurée uniquement
              dans Render. Voir le guide CANDIDATE_ACCOUNTS du projet.
            </p>
          ) : (
            <>
              <div className="candidate-grid">
                {[
                  ["Comptes", data.stats.accounts],
                  [
                    "Comptes confirmés avec profil",
                    data.stats.verifiedAccounts,
                  ],
                  ["Candidatures confirmées", data.stats.applications],
                ].map(([label, value]) => (
                  <div className="candidate-box" key={label}>
                    <strong>{value}</strong>
                    {label}
                  </div>
                ))}
              </div>
              <div className="candidate-table">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Jour",
                        "Pages vues",
                        "Comptes actifs",
                        "Clics des comptes",
                        "Confirmations",
                      ].map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.daily.map((d) => (
                      <tr key={d.day}>
                        <td>{new Date(d.day).toLocaleDateString("fr-FR")}</td>
                        <td>{d.views}</td>
                        <td>{d.authenticated_users}</td>
                        <td>{d.outbound_clicks}</td>
                        <td>{d.applications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Compteurs indicatifs : les pages vues peuvent inclure des robots
                et des visites répétées. Les comptes actifs sont dédupliqués par
                jour ; les visiteurs anonymes ne le sont pas. Les clics et confirmations concernent les comptes connectés. Aucune adresse
                e-mail ni note personnelle n’est affichée ici.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
