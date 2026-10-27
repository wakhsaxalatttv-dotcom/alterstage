import React, { useState, useEffect } from "react";
import { ShieldCheck, ExternalLink, Check, X, RotateCcw } from "lucide-react";
import { request } from "./api";
import { Pagination } from "./CatalogueParts";
import { SourcePanel } from "./SourcePanel";
import { EmployerForm } from "./EmployerForm";
export function Moderation({ onChanged }) {
  const [token, setToken] = useState(""),
    [authenticated, setAuthenticated] = useState(false),
    [offers, setOffers] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("pending");
  const [counts, setCounts] = useState({}),
    [adminPage, setAdminPage] = useState(1),
    [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  useEffect(() => {
    if (authenticated) load();
  }, [view, adminPage]);
  async function load(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request(
        "/api/admin/submissions?" +
          new URLSearchParams({ moderation: view, page: adminPage }),
        { token },
      );
      setOffers(data.offers);
      setCounts(data.counts || {});
      setPagination(data);
      setAuthenticated(true);
    } catch (e) {
      setError(e.message);
      setAuthenticated(false);
    } finally {
      setBusy(false);
    }
  }
  async function review(id, body) {
    setError("");
    await request(`/api/admin/submissions/${id}/review`, {
      token,
      method: "POST",
      body: JSON.stringify(body),
    });
    await load();
    onChanged();
  }
  return (
    <section className="moderation">
      <div className="local-note">
        <ShieldCheck size={21} />
        <p>
          Accès réservé au responsable du catalogue. Le jeton reste en mémoire
          et n’est pas enregistré dans le navigateur. Chaque publication demande
          une vérification humaine ; aucun lien saisi n’est récupéré
          automatiquement par le serveur.
        </p>
      </div>
      {!authenticated ? (
        <form className="admin-login" onSubmit={load}>
          <label className="field">
            Jeton de modération
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Connexion…" : "Accéder à la modération"}
          </button>
        </form>
      ) : (
        <>
          <div className="admin-toolbar">
            <button className="secondary" onClick={load} disabled={busy}>
              <RotateCcw size={15} /> Actualiser
            </button>
            <button
              onClick={() => {
                setAuthenticated(false);
                setToken("");
                setOffers([]);
              }}
            >
              Déconnexion
            </button>
          </div>
          <div className="admin-tabs">
            {[
              ["pending", "À valider"],
              ["approved", "Publiées"],
              ["rejected", "Refusées"],
              ["withdrawn", "Retirées"],
              ["import", "Ajouter depuis une source"],
              ["sources", "Sources & collecte"],
            ].map(([id, label]) => (
              <button
                className={view === id ? "active" : ""}
                key={id}
                onClick={() => {
                  setView(id);
                  setAdminPage(1);
                }}
              >
                {label}
                {!["import", "sources"].includes(id) && ` (${counts[id] || 0})`}
              </button>
            ))}
          </div>
          {view === "sources" ? (
            <SourcePanel token={token} onChanged={onChanged} />
          ) : view === "import" ? (
            <>
              <p className="muted">
                Import éditorial manuel uniquement : recopiez une annonce avec
                autorisation. Les dates et contacts doivent provenir de la page
                originale, et non des extraits Google. Le dépôt devra ensuite
                être validé.
              </p>
              <EmployerForm token={token} editorial onSaved={() => load()} />
            </>
          ) : (
            <div className="review-list">
              {offers
                .filter((o) => o.moderationStatus === view)
                .map((o) => (
                  <Review key={o.id} offer={o} review={review} />
                ))}
              <Pagination {...pagination} onChange={setAdminPage} />
              {!offers.some((o) => o.moderationStatus === view) && (
                <p className="empty-admin">
                  Aucune annonce dans cette catégorie.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
function Review({ offer: o, review }) {
  const [checks, setChecks] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(action) {
    setBusy(true);
    setError("");
    try {
      await review(o.id, { action, ...checks });
      setChecks({});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="review-card">
      <div className="tags">
        <span>
          {o.origin === "feed"
            ? "Collecte de flux autorisé"
            : o.origin === "editorial"
              ? "Import éditorial"
              : "Dépôt entreprise"}
        </span>
        <span>{o.domain}</span>
        <span>{o.contract}</span>
      </div>
      <h2>{o.title}</h2>
      <h3>
        {o.company.name} · {o.location.label}
      </h3>
      <p>
        Publication source :{" "}
        {o.publishedAt || "Non fournie — publication bloquée"} · Échéance
        interne : {o.expiresAt}
      </p>
      <p className="description">{o.description}</p>
      {o.company.description && (
        <p className="description">
          Présentation entreprise : {o.company.description}
        </p>
      )}
      <dl className="review-company-data">
        {[
          ["Type", o.company.type],
          ["Effectif", o.company.size],
          ["Agences", o.company.locations?.join(" · ")],
          ["Stack déclarée", o.company.stack?.join(" · ")],
          ["Rythme accepté", o.company.rhythm],
          ["Certifications", o.company.certifications?.join(" · ")],
          ["Expertises", o.company.tags?.join(" · ")],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <React.Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
      </dl>
      {o.company.profileSourceUrl && (
        <p>
          <a href={o.company.profileSourceUrl} target="_blank" rel="noreferrer">
            Contrôler la provenance des informations entreprise
          </a>
        </p>
      )}
      {o.technologies?.length > 0 && (
        <p className="muted">
          Mentions extraites automatiquement (à relire) :{" "}
          {o.technologies.join(", ")}
        </p>
      )}
      {(o.extractedKeywords?.education?.length > 0 ||
        o.extractedKeywords?.locations?.length > 0) && (
        <p className="muted">
          Autres mentions à relire : niveaux{" "}
          {o.extractedKeywords.education.join(", ") || "non détectés"} ; lieux{" "}
          {o.extractedKeywords.locations?.join(", ") || "non détectés"}. Ces
          propositions ne remplacent pas les champs source.
        </p>
      )}
      <div className="review-links">
        {[
          ["Site entreprise", o.company.website],
          ["Annonce originale", o.sourceUrl],
          ["Candidature", o.applicationUrl],
        ].map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer">
            {label} <ExternalLink size={14} />
          </a>
        ))}
      </div>
      {o.publicContacts.map((c) => (
        <p key={c.value}>
          Contact proposé : {c.value} —{" "}
          <a href={c.provenance} target="_blank" rel="noreferrer">
            Contrôler la provenance
          </a>
        </p>
      ))}
      {["pending", "approved"].includes(o.moderationStatus) && (
        <>
          <div className="review-checks">
            {[
              [
                "sourceChecked",
                "J’ai ouvert l’annonce originale : elle est récente, toujours ouverte et correspond à ce poste technique ou informatique.",
              ],
              [
                "rightsChecked",
                "La republication de cette description et des données est autorisée (accord de l’entreprise ou conditions applicables).",
              ],
              [
                "companyChecked",
                "J’ai contrôlé l’identité de l’entreprise et le lien avec le déposant ou la source ; ce n’est pas une annonce d’école.",
              ],
              [
                "contactChecked",
                "J’ai contrôlé les liens, dates et éventuels contacts génériques publics ; aucune coordonnée personnelle n’est publiée.",
              ],
            ].map(([key, label]) => (
              <label className="consent" key={key}>
                <input
                  type="checkbox"
                  checked={!!checks[key]}
                  onChange={(e) =>
                    setChecks({ ...checks, [key]: e.target.checked })
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button
              className="primary"
              disabled={
                busy || Object.values(checks).filter(Boolean).length !== 4
              }
              onClick={() => action("approve")}
            >
              <Check size={16} />
              {o.moderationStatus === "approved"
                ? "Revérifier l’annonce"
                : "Valider et publier"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                action(
                  o.moderationStatus === "approved" ? "withdraw" : "reject",
                )
              }
            >
              <X size={16} />
              {o.moderationStatus === "approved" ? "Retirer" : "Refuser"}
            </button>
          </div>
        </>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </article>
  );
}
