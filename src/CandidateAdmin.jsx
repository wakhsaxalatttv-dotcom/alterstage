import React, { useEffect, useState } from "react";
import { request } from "./api";
import "./candidate.css";
const diagnosticLabels = {
  email_delivery:
    "Supabase n’a pas pu envoyer l’e-mail. Vérifiez l’expéditeur validé dans Brevo, le serveur, le port, l’identifiant et la clé SMTP dans Supabase.",
  network:
    "Le serveur n’a pas pu joindre Supabase. Vérifiez la disponibilité du projet et la connexion réseau.",
  credentials:
    "L’accès au projet Supabase a été refusé. Vérifiez l’URL et la clé publique configurées sur le serveur.",
  schema:
    "Le contrôle de migration Supabase a échoué. Vérifiez l’exécution complète du fichier SQL.",
  registration_disabled:
    "Supabase refuse les inscriptions. Vérifiez les réglages Email et les inscriptions autorisées.",
  rate_limit:
    "La limite de demandes du fournisseur a été atteinte. Attendez avant de refaire un essai.",
  service:
    "Supabase a renvoyé une erreur serveur. Consultez les logs Auth à la même heure.",
  request:
    "Une demande a été refusée. Consultez les logs Auth si l’erreur persiste.",
};

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
          <section
            className="candidate-box"
            aria-label="Diagnostic des comptes"
          >
            <h3>Derniers échecs de connexion et d’envoi</h3>
            <p>
              Diagnostic privé limité aux 20 derniers échecs depuis le démarrage
              du serveur. Aucun contenu de message, adresse e-mail ni clé n’est
              enregistré ici.
            </p>
            {data.diagnostics?.length ? (
              <ul>
                {data.diagnostics.map((d, i) => (
                  <li key={d.at + ":" + i}>
                    <strong>
                      {new Date(d.at).toLocaleString("fr-FR")} · {d.operation}
                    </strong>
                    <p>
                      {diagnosticLabels[d.category] || diagnosticLabels.request}
                    </p>
                    <small>
                      {d.status ? "HTTP " + d.status : "Réseau"} · {d.code}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Aucun échec enregistré sur cette instance. Cela ne confirme pas
                la réception des e-mails.
              </p>
            )}
          </section>
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
                jour ; les visiteurs anonymes ne le sont pas. Les clics et
                confirmations concernent les comptes connectés. Aucune adresse
                e-mail ni note personnelle n’est affichée ici.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
