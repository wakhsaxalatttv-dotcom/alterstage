import React, { useState, useEffect, useRef } from "react";
import { Companies } from "./Companies";
import { request } from "./api";
import { contracts } from "../shared/catalog";
import { companySizes } from "../shared/company";
export function CompanyReviewPanel({ token, onChanged }) {
  const [selected, setSelected] = useState(null),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState("");
  function choose(company) {
    setSelected(company);
    setNotice("");
  }
  return (
    <section>
      <h2>Contrôler les conditions d’accueil</h2>
      <p className="muted">
        L’annuaire ne constitue pas une certification. Sélectionnez une
        entreprise, puis consignez uniquement les conditions confirmées par une
        source publique. Les contacts personnels ne sont pas ajoutés.
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {selected && (
        <Review
          key={selected.id}
          company={selected}
          token={token}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setVersion((v) => v + 1);
            setNotice(
              "Contrôle enregistré. Le statut public et les filtres ont été actualisés.",
            );
            onChanged();
          }}
        />
      )}
      <Companies key={version} openCompany={choose} />
    </section>
  );
}
function Review({ company, token, onClose, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }, []);
  async function send(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await save({
      ...Object.fromEntries(data),
      acceptedContracts: data.getAll("acceptedContracts"),
      identityChecked: data.has("identityChecked"),
      conditionsChecked: data.has("conditionsChecked"),
      sourceChecked: data.has("sourceChecked"),
    });
  }
  async function save(body) {
    setBusy(true);
    setError("");
    try {
      await request(
        `/api/admin/companies/${encodeURIComponent(company.id)}/review`,
        { token, method: "POST", body: JSON.stringify(body) },
      );
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const existing = company.hostingReview;
  return (
    <form className="company-review-form" onSubmit={send}>
      <h3 tabIndex={-1} ref={heading}>
        {company.name}
      </h3>
      <p>
        Sourcez les contrats et conditions d’accueil. Un champ vide reste
        inconnu ; aucun rythme, effectif ou contact n’est déduit des
        technologies d’une annonce.
      </p>
      <label className="field">
        Source des conditions d’accueil
        <input
          name="sourceUrl"
          type="url"
          required
          placeholder="https://…"
          defaultValue={existing?.sourceUrl || ""}
        />
      </label>
      <fieldset>
        <legend>Contrats confirmés par la source</legend>
        {contracts.map((contract) => (
          <label className="consent" key={contract}>
            <input
              type="checkbox"
              name="acceptedContracts"
              value={contract}
              defaultChecked={existing?.acceptedContracts?.includes(contract)}
            />
            {contract}
          </label>
        ))}
      </fieldset>
      <div className="form-grid">
        <label className="field">
          Rythmes explicitement acceptés
          <input
            name="rhythms"
            defaultValue={existing?.rhythms?.join("; ") || ""}
            placeholder="Laisser vide si non fourni"
          />
        </label>
        <label className="field">
          Taille documentée
          <select
            aria-label="Taille documentée"
            name="size"
            defaultValue={company.size || ""}
          >
            <option value="">Non fournie</option>
            {companySizes.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Technologies déclarées par l’entreprise
          <input name="stack" defaultValue={company.stack?.join("; ") || ""} />
        </label>
        <label className="field">
          Agences ou implantations sourcées
          <input
            name="locations"
            defaultValue={company.locations?.join("; ") || ""}
          />
        </label>
      </div>
      <label className="consent">
        <input required type="checkbox" name="identityChecked" />
        Identité de l’entreprise contrôlée.
      </label>
      <label className="consent">
        <input required type="checkbox" name="sourceChecked" />
        Source publique consultée et informations relues.
      </label>
      <label className="consent">
        <input required type="checkbox" name="conditionsChecked" />
        Contrats et conditions d’accueil confirmés par cette source.
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          Enregistrer le contrôle d’accueil
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Annuler
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => save({ action: "revoke" })}
            disabled={busy}
          >
            Retirer le contrôle d’accueil
          </button>
        )}
      </div>
    </form>
  );
}
