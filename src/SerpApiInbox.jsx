import React, { useEffect, useState } from "react";
import { request } from "./api";
import { EmployerForm } from "./EmployerForm";
export function SerpApiInbox({ token, configured }) {
  const [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("alternance informatique"),
    [rights, setRights] = useState(false),
    [selected, setSelected] = useState(null);
  const load = async () => {
    try {
      setItems(
        (await request("/api/admin/serpapi/candidates", { token })).items,
      );
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [token]);
  async function collect() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/admin/serpapi/import", {
        token,
        method: "POST",
        body: JSON.stringify({ rightsConfirmed: rights, query }),
      });
      setMessage(
        result.imported
          ? `${result.imported.created} nouveau(x), ${result.imported.duplicate} doublon(s), ${result.imported.excluded} exclu(s). Aucune publication automatique.`
          : result.message,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function reject(id) {
    setError("");
    try {
      await request(`/api/admin/serpapi/candidates/${id}/reject`, {
        token,
        method: "POST",
        body: "{}",
      });
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="serpapi-inbox" aria-labelledby="serpapi-inbox-title">
      <h4 id="serpapi-inbox-title">Importer dans la file privée Google Jobs</h4>
      <p>
        Une page de la recherche sélectionnée en France par clic. Le test et
        l’import partagent la limite d’un appel par minute et trois par heure.
        Une recherche ciblée ne couvre pas toutes les offres du marché.
      </p>
      <label className="field">
        Recherche Google Jobs
        <select value={query} onChange={(e) => setQuery(e.target.value)}>
          {[
            "alternance informatique",
            "stage informatique",
            "alternance réseaux télécommunications",
            "stage systèmes électroniques",
            "alternance maintenance industrielle",
            "stage chimie matériaux",
            "alternance chimie procédés",
          ].map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
      </label>
      <label className="consent">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
        />{" "}
        Je confirme disposer des droits de conservation et de réutilisation des
        annonces et descriptions provenant de ces sources.
      </label>
      <button
        className="secondary"
        onClick={collect}
        disabled={!configured || !rights || busy}
      >
        {busy ? "Import en cours…" : "Importer Google Jobs"}
      </button>
      {message && (
        <p role="status" className="local-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p>
        Sans date exacte, contrat, domaine technique et région confirmés, un
        résultat reste privé. Les descriptions sont nettoyées et les coordonnées
        retirées.
      </p>
      {items.length === 0 && (
        <p className="muted">Aucun résultat à examiner.</p>
      )}
      <div className="review-list">
        {items.map((item) => (
          <article key={item.id} className="local-note">
            <h4>{item.title}</h4>
            <p>
              {item.companyName} · {item.location}
            </p>
            <p>
              {item.publishedAt
                ? `Date fournie : ${item.publishedAt}`
                : "Date de publication non fournie — à confirmer sur la source originale."}
            </p>
            {item.publicationText && (
              <p className="muted">
                Indication du fournisseur : {item.publicationText}
              </p>
            )}
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              Consulter la source
            </a>
            <div className="button-row">
              <button className="secondary" onClick={() => setSelected(item)}>
                Compléter pour validation
              </button>
              <button className="secondary" onClick={() => reject(item.id)}>
                Écarter
              </button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <section className="local-note">
          <h4>Préparer : {selected.title}</h4>
          <p>
            Le site officiel de l’entreprise, la région, le domaine et le
            contrat doivent être documentés. La date doit venir de la source
            originale, pas d’une estimation Google. L’envoi crée ensuite une
            annonce « En attente », à contrôler avant publication.
          </p>
          <button className="secondary" onClick={() => setSelected(null)}>
            Fermer la préparation
          </button>
          <EmployerForm
            key={selected.id}
            token={token}
            editorial
            initialValues={selected}
            sourceDateRequired
            submitEndpoint={`/api/admin/serpapi/candidates/${selected.id}/submit`}
            onSaved={() => {
              setSelected(null);
              setMessage(
                "Annonce transmise à la rubrique En attente. Elle reste non publiée.",
              );
              load();
            }}
          />
        </section>
      )}
    </section>
  );
}
