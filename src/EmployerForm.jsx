import React, { useState } from "react";
import { ArrowRight, Check, ShieldCheck, Building2, Eye } from "lucide-react";
import { domainGroups, contracts, educationLevels } from "../shared/catalog";
import { companyTypes, companySizes, companyTags } from "../shared/company";
import { regions } from "./domain";
import { request } from "./api";
const today = () => new Date().toISOString().slice(0, 10);
function Field({
  label,
  name,
  type = "text",
  required = false,
  help,
  maxLength = 200,
  ...props
}) {
  return (
    <label className="field" htmlFor={`deposit-${name}`}>
      {label}
      {required ? " *" : ""}
      <input
        id={`deposit-${name}`}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        {...props}
      />
      {help && <small>{help}</small>}
    </label>
  );
}
export function EmployerForm({ token, editorial = false, onSaved }) {
  const [state, setState] = useState({ status: "idle" }),
    [preview, setPreview] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget,
      body = Object.fromEntries(new FormData(form));
    body.companyTags = new FormData(form).getAll("companyTags");
    body.logoConsent = body.logoConsent === "on";
    body.consent = body.consent === "on";
    body.contactConsent = body.contactConsent === "on";
    setState({ status: "loading" });
    try {
      const data = await request(
        editorial ? "/api/admin/import" : "/api/submissions",
        { token, method: "POST", body: JSON.stringify(body) },
      );
      setState({ status: "saved", id: data.id });
      setPreview(null);
      onSaved?.();
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  }
  if (state.status === "saved")
    return (
      <section className="submission-success" role="status">
        <span className="success-icon">
          <Check size={30} />
        </span>
        <h2>Annonce reçue, en attente de validation</h2>
        <p>
          Votre dépôt est enregistré côté serveur. Il n’est pas encore visible
          dans les résultats : l’entreprise, la source, la date et les droits de
          publication doivent être contrôlés.
        </p>
        <p className="reference">Référence : {state.id}</p>
        <p className="muted">
          Conservez cette référence. Aucun e-mail automatique n’est envoyé. La
          conservation des dépôts nécessite un stockage serveur persistant.
        </p>
        <button
          className="secondary"
          onClick={() => setState({ status: "idle" })}
        >
          Déposer une autre annonce <ArrowRight size={16} />
        </button>
      </section>
    );
  return (
    <div className="employer-layout">
      <form className="employer-form" onSubmit={submit}>
        <div className="form-section-title">
          <span>01</span>
          <div>
            <h2>L’entreprise, sans détour</h2>
            <p>Renseignez uniquement des informations réelles et autorisées.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Nom de l’entreprise"
            name="companyName"
            required
            maxLength={120}
          />
          <Field
            label="Site officiel de l’entreprise"
            name="companyWebsite"
            type="url"
            required
            placeholder="https://…"
          />
          <Field label="Secteur d’activité" name="sector" />
          <Field label="Ville du poste" name="city" required maxLength={120} />
        </div>
        <div className="form-grid">
          <label className="field">
            Type d’entreprise (si fourni)
            <select name="companyType" defaultValue="">
              <option value="">Non fourni</option>
              {companyTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Effectif (si documenté)
            <select name="companySize" defaultValue="">
              <option value="">Non fourni</option>
              {companySizes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <Field
            label="Agences et implantations"
            name="companyLocations"
            help="Villes ou agences séparées par une virgule, uniquement si documentées."
          />
          <Field
            label="Stack technique déclarée"
            name="companyStack"
            help="Technologies séparées par une virgule. Ne pas déduire la stack d’une seule annonce."
          />
          <Field
            label="Rythme d’alternance accepté"
            name="companyRhythm"
            help="Seulement si l’entreprise l’a précisé."
          />
          <Field
            label="Labels et certifications"
            name="companyCertifications"
            help="Libellés exacts séparés par une virgule ; ne rien présumer."
          />
        </div>
        <fieldset className="company-tag-fields">
          <legend>Expertises déclarées</legend>
          <div className="tag-checkboxes">
            {companyTags.map((tag) => (
              <label className="consent" key={tag}>
                <input type="checkbox" name="companyTags" value={tag} />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          label="Logo autorisé (URL HTTPS, facultatif)"
          name="companyLogoUrl"
          type="url"
        />
        <label className="consent">
          <input type="checkbox" name="logoConsent" />
          <span>
            Si j’ajoute un logo, je confirme disposer du droit de le diffuser
            pour représenter l’entreprise.
          </span>
        </label>
        <Field
          label="Page source des informations entreprise enrichies"
          name="profileSourceUrl"
          type="url"
          help="Obligatoire pour tout type, taille, implantation, stack, rythme, label ou tag renseigné."
        />
        <label className="field">
          Présentation de l’entreprise (facultative)
          <textarea
            name="companyDescription"
            rows="3"
            maxLength="2000"
            placeholder="Une présentation fournie par l’entreprise ou dont la republication est autorisée."
          />
        </label>
        <div className="form-section-title">
          <span>02</span>
          <div>
            <h2>Une opportunité technique ou informatique</h2>
            <p>Stages, apprentissage et professionnalisation uniquement.</p>
          </div>
        </div>
        <Field
          label="Intitulé du poste"
          name="title"
          required
          maxLength={180}
        />
        <div className="form-grid">
          <label className="field">
            Domaine *
            <select name="domain" required defaultValue="">
              <option value="" disabled>
                Choisir une spécialité
              </option>
              {Object.entries(domainGroups).map(([group, values]) => (
                <optgroup key={group} label={group}>
                  {values.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            Type de contrat *
            <select name="contract" required defaultValue="">
              <option value="" disabled>
                Choisir un contrat
              </option>
              {contracts.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Région *
            <select name="region" required defaultValue="">
              <option value="" disabled>
                Choisir une région
              </option>
              {Object.keys(regions).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Niveau demandé
            <select name="education" defaultValue="">
              <option value="">Non fourni</option>
              {educationLevels.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Description du poste *
          <textarea
            name="description"
            minLength="2"
            maxLength="12000"
            required
            rows="6"
            placeholder="Décrivez le poste à partir de l’annonce originale, sans inventer les informations manquantes."
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Missions (une par ligne)
            <textarea name="missions" maxLength="4000" rows="4" />
          </label>
          <label className="field">
            Compétences (une par ligne)
            <textarea name="skills" maxLength="2000" rows="4" />
          </label>
          <Field
            label="Durée du contrat"
            name="duration"
            placeholder="Uniquement si elle est précisée"
            maxLength={120}
          />
          <Field label="Date de début" name="startsAt" type="date" />
        </div>
        <div className="form-section-title">
          <span>03</span>
          <div>
            <h2>La source et les dates</h2>
            <p>Le lien original reste toujours accessible aux candidats.</p>
          </div>
        </div>
        <Field
          label="Lien de l’annonce originale"
          name="sourceUrl"
          type="url"
          required
          help="URL HTTPS d’une annonce de l’entreprise. Un lien Google ou une page d’accueil ne suffit pas."
        />
        <Field
          label="Lien officiel de candidature"
          name="applicationUrl"
          type="url"
          help="Laisser vide pour utiliser le lien de l’annonce originale."
        />
        <div className="form-grid">
          <Field
            label="Date de publication fournie par la source"
            name="publishedAt"
            type="date"
            max={today()}
            help="Ne devinez pas la date. Sans date fournie, le dépôt reste en attente et ne peut pas être publié."
          />
          <Field
            label="Fin de validité sur Offres Fraîches"
            name="expiresAt"
            type="date"
            required
            min={today()}
            help="Choisissez une échéance entre aujourd’hui et 90 jours. Ce réglage n’est pas une date de fermeture déclarée par la source."
          />
        </div>
        <div className="form-section-title">
          <span>04</span>
          <div>
            <h2>Un contact public, si disponible</h2>
            <p>
              Facultatif. À défaut, les candidats utilisent le lien officiel.
            </p>
          </div>
        </div>
        <label className="field">
          Rôle du contact (si précisé par la source)
          <select name="contactRole" defaultValue="">
            <option value="">Non fourni</option>
            {["RH", "Tutorat", "Recrutement"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <Field
          label="E-mail générique de recrutement"
          name="publicEmail"
          type="email"
          maxLength={180}
          help="Une boîte générique sur le domaine de l’entreprise (recrutement, jobs, rh…). Aucune adresse personnelle."
        />
        <Field
          label="Page officielle où ce contact est publié"
          name="contactProvenance"
          type="url"
        />
        <label className="consent">
          <input type="checkbox" name="contactConsent" />
          <span>
            Si j’ajoute un contact, je confirme qu’il s’agit d’une boîte
            générique publique et que sa diffusion est autorisée.
          </span>
        </label>
        <div className="trap" aria-hidden="true">
          <label>
            Ne pas remplir
            <input name="websiteTrap" tabIndex="-1" autoComplete="off" />
          </label>
        </div>
        <label className="consent">
          <input type="checkbox" name="consent" required />
          <span>
            Je représente cette entreprise ou dispose d’une autorisation de
            republication. Je confirme qu’il s’agit d’une offre réelle
            d’entreprise, et autorise sa diffusion après validation. *
          </span>
        </label>
        {state.status === "error" && (
          <div role="alert" className="form-error">
            {state.message}
          </div>
        )}
        <div className="form-actions">
          <button
            className="secondary"
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form.reportValidity()) {
                const d = Object.fromEntries(new FormData(form));
                setPreview(d);
              }
            }}
          >
            <Eye size={16} /> Aperçu du dépôt
          </button>
          <button className="primary" disabled={state.status === "loading"}>
            {state.status === "loading"
              ? "Enregistrement…"
              : "Soumettre à la validation"}
            <ArrowRight size={16} />
          </button>
        </div>
        {preview && (
          <div className="draft-preview">
            <span className="eyebrow">BROUILLON — NON PUBLIÉ</span>
            <h3>{preview.title}</h3>
            <p>
              {preview.companyName} · {preview.city} · {preview.region}
            </p>
            <div className="tags">
              <span>{preview.contract}</span>
              <span>{preview.domain}</span>
            </div>
            <p className="description">{preview.description}</p>
            <p>
              Publication source : {preview.publishedAt || "Non fournie"} ·
              Vérification : non effectuée
            </p>
          </div>
        )}
      </form>
      <aside className="employer-help">
        <span className="help-icon">
          <Building2 size={25} />
        </span>
        <h2>Le recrutement commence par la confiance.</h2>
        <p>
          Votre annonce rejoint le catalogue après contrôle manuel. Déposer ne
          signifie pas publier immédiatement.
        </p>
        <ul>
          <li>
            <Check size={15} /> Gratuit pour cette version
          </li>
          <li>
            <Check size={15} /> Technique et informatique
          </li>
          <li>
            <Check size={15} /> Aucun contact inventé
          </li>
          <li>
            <Check size={15} /> Liens officiels conservés
          </li>
        </ul>
        <div className="local-note">
          <ShieldCheck size={20} />
          <p>
            Les annonces d’écoles et les données personnelles de recruteurs ne
            sont pas acceptées.
          </p>
        </div>
      </aside>
    </div>
  );
}
