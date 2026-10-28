import React, { useState, useEffect } from "react";
import { request } from "./api";
import { reportReasons } from "../shared/reporting";
import { Pagination } from "./CatalogueParts";
export function ReportsPanel({ token, onChanged }) {
  const [status, setStatus] = useState("open"),
    [page, setPage] = useState(1),
    [data, setData] = useState({ reports: [], counts: {} }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    request("/api/admin/reports?" + new URLSearchParams({ status, page }), {
      token,
      signal: controller.signal,
    })
      .then(setData)
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, page, refresh, token]);
  async function review(id, body) {
    await request(`/api/admin/reports/${id}/review`, {
      token,
      method: "POST",
      body: JSON.stringify(body),
    });
    setRefresh((n) => n + 1);
    onChanged();
  }
  return (
    <section aria-label="Signalements reçus">
      <h2>Signalements des visiteurs</h2>
      <p>
        Examinez la source avant de décider. Un signalement ne retire jamais
        automatiquement une annonce.
      </p>
      <div className="admin-tabs">
        {[
          ["open", "À traiter"],
          ["resolved", "Traités"],
          ["dismissed", "Classés sans suite"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={status === id ? "active" : ""}
            onClick={() => {
              setStatus(id);
              setPage(1);
            }}
          >
            {label} ({data.counts[id] || 0})
          </button>
        ))}
        <button className="secondary" onClick={() => setRefresh((n) => n + 1)}>
          Actualiser les signalements
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Chargement des signalements…</p>
      ) : (
        <>
          <div className="review-list">
            {data.reports.map((report) => (
              <Report key={report.id} report={report} review={review} />
            ))}
          </div>
          {!data.reports.length && (
            <p className="empty-admin">
              Aucun signalement dans cette catégorie.
            </p>
          )}
          <Pagination {...data} onChange={setPage} />
        </>
      )}
    </section>
  );
}
function Report({ report, review }) {
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(action) {
    setBusy(true);
    setError("");
    try {
      await review(report.id, { action, note });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="review-card report-card">
      <div className="tags">
        <span>
          {report.target_kind === "reference" ? "Offre repérée" : "Catalogue"}
        </span>
        <span>{new Date(report.created_at).toLocaleString("fr-FR")}</span>
      </div>
      <h3>{report.offer.title}</h3>
      <p>{report.offer.company}</p>
      <p>
        <strong>Motif : {reportReasons[report.reason]}</strong>
      </p>
      {report.details && <p className="description">{report.details}</p>}
      <a
        href={report.offer.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Consulter l’annonce officielle ↗
      </a>
      {report.status === "open" ? (
        <>
          <label className="field">
            Note de traitement
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => act("resolve")}
            >
              Marquer comme traité
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => act("dismiss")}
            >
              Classer sans suite
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => act("withdraw")}
            >
              Retirer l’annonce du site
            </button>
          </div>
        </>
      ) : (
        <p className="local-note">
          {report.last_action === "withdraw"
            ? "Annonce retirée du site."
            : report.status === "dismissed"
              ? "Classé sans suite."
              : "Signalement traité."}{" "}
          {report.review_note}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
