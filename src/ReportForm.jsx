import React, { useState } from "react";
import { request } from "./api";
import { reportReasons } from "../shared/reporting";
export function ReportForm({ offer, onSent }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          offerId: offer.id,
          reason: form.get("reason"),
          details: form.get("details"),
        }),
      });
      onSent();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="report-form" onSubmit={submit}>
      <p>
        Votre signalement sera transmis au responsable du site pour examen. Il
        ne sera pas publié et aucun message ne sera envoyé à l’entreprise.
      </p>
      <label className="field">
        Motif
        <select name="reason" aria-label="Motif" required>
          {Object.entries(reportReasons).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Précisions (facultatif)
        <textarea
          name="details"
          maxLength={1500}
          rows={4}
          placeholder="Indiquez le problème constaté, sans donnée personnelle."
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy} type="submit">
        {busy ? "Envoi…" : "Envoyer le signalement"}
      </button>
    </form>
  );
}
