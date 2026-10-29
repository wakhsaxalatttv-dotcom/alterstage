import { RapidApiProbe } from "./RapidApiProbe";
import React, { useEffect, useState, useRef } from "react";
import { RefreshCw, Database, ExternalLink } from "lucide-react";
import { request } from "./api";
import { Skeletons } from "./CatalogueParts";
export function SourcePanel({ token, onChanged }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !data?.running) onChanged();
    wasRunning.current = !!data?.running;
  }, [data?.running]);
  useEffect(() => {
    if (!data?.running) return;
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, [data]);
  async function load() {
    try {
      setData(await request("/api/admin/sources", { token }));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function collect() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/admin/ingest", {
        token,
        method: "POST",
        body: "{}",
      });
      setMessage(result.message);
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="source-panel">
      <RapidApiProbe token={token} />
      <h2>
        <Database size={20} />
        Sources et collecte autorisée
      </h2>
      <p>
        Les connecteurs JSON et RSS/Atom alimentent la file de validation, les
        annonces API sélectionnées restent non revérifiées dans le catalogue
        public. France Travail est activé lorsque ses deux identifiants serveur
        sont configurés ; la connexion doit ensuite réussir.
      </p>
      <p className="muted">
        Configuration serveur : SOURCES_FILE. Consultez le guide{" "}
        <code>docs/INGESTION.md</code> du dépôt pour le format, les
        autorisations et les limites.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!data && !error ? (
        <Skeletons count={1} />
      ) : (
        data && (
          <>
            {data.error && <p className="form-error">{data.error}</p>}
            {!data.configured && (
              <div className="local-note">
                Source non configurée. Le catalogue et les dépôts manuels
                restent utilisables.
              </div>
            )}
            <div className="source-statuses">
              {data.sources.map((s) => (
                <article key={s.id}>
                  <strong>{s.name}</strong>
                  <span>
                    {s.kind} ·{" "}
                    {
                      {
                        disabled: "désactivée",
                        not_configured:
                          "source non configurée — identifiant ou secret absent",
                        authorization_required: "autorisation requise",
                        configured: "configurée — connexion à tester",
                      }[s.status]
                    }
                  </span>
                </article>
              ))}
            </div>
            <button
              className="primary"
              onClick={collect}
              disabled={busy || data.running || !data.configured}
            >
              <RefreshCw size={16} />
              {busy || data.running
                ? "Collecte en cours…"
                : "Lancer une collecte"}
            </button>
            <h3>Dernières exécutions</h3>
            {data.runs.length ? (
              <div className="ingestion-runs">
                {data.runs.map((r, i) => (
                  <article key={i}>
                    <strong>
                      {r.sourceId} ·{" "}
                      {
                        {
                          success: "terminée",
                          partial: "partielle",
                          error: "échec",
                          skipped: "non exécutée",
                        }[r.status]
                      }
                    </strong>
                    <p>
                      {new Date(r.finishedAt).toLocaleString("fr-FR")} ·{" "}
                      {r.created} nouvelle(s), {r.updated} modifiée(s),{" "}
                      {r.unchanged} inchangée(s), {r.duplicate} doublon(s),{" "}
                      {r.invalid} invalide(s)
                    </p>
                    {r.coverage && (
                      <p>
                        Parcours des métiers : {r.coverage.completedRomeCodes} /{" "}
                        {r.coverage.totalRomeCodes}.{" "}
                        {r.coverage.truncated
                          ? "Parcours incomplet — d’autres offres peuvent rester à collecter."
                          : "Parcours terminé sur la période recherchée."}
                      </p>
                    )}
                    {r.message && <p>{r.message}</p>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Aucune collecte exécutée.</p>
            )}
          </>
        )
      )}
    </section>
  );
}
