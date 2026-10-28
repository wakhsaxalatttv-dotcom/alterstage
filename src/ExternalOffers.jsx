import { CompanyLogo } from "./CompanyLogo";
import React, { useState, useEffect } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Dialog, Filter } from "./components";
import { selectOffers, defaultFilters, regions } from "./domain";
import { educationLevels } from "../shared/catalog";
import { request } from "./api";
import { ReportForm } from "./ReportForm";
const date = (value) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "Non fournie";
export function ExternalOffers() {
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState({ offers: [], loading: true, error: "" });
  const [reporting, setReporting] = useState(false),
    [reported, setReported] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData((previous) => ({ ...previous, loading: true, error: "" }));
    request("/api/references", { signal: controller.signal })
      .then((result) =>
        setData({ offers: result.offers, loading: false, error: "" }),
      )
      .catch((error) => {
        if (error.name !== "AbortError")
          setData({ offers: [], loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [refresh]);
  const externalOffers = data.offers;
  const open = (offer) => {
    setSelected(offer);
    setReporting(false);
    setReported(false);
  };
  const [filters, setFilters] = useState(defaultFilters);
  const change = (key, value) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const offers = selectOffers(externalOffers, filters);
  const domains = [
    ...new Set(externalOffers.map((offer) => offer.domain)),
  ].sort();
  const technologies = [
    ...new Set(externalOffers.flatMap((offer) => offer.technologies)),
  ].sort();
  return (
    <section
      className="external-offers"
      aria-labelledby="external-title"
      id="offres-reperees"
    >
      <div className="external-heading">
        <div>
          <p className="eyebrow">DIRECTEMENT CHEZ L’EMPLOYEUR</p>
          <h2 id="external-title">Sélection des entreprises</h2>
        </div>
        <span role="status">
          {offers.length} lien{offers.length > 1 ? "s" : ""} avec vos filtres
        </span>
      </div>
      <p>
        Annonces issues des sites d’entreprises. Retrouvez les missions dans la
        fiche détaillée et candidatez sur le site officiel, où la disponibilité
        reste à confirmer.
      </p>
      <div
        className="domain-shortcuts"
        role="group"
        aria-label="Raccourcis par domaine"
      >
        <button
          className={!filters.domain ? "active" : ""}
          aria-pressed={!filters.domain}
          onClick={() => setFilters(defaultFilters)}
        >
          Tous les domaines
        </button>
        {domains.map((domain) => (
          <button
            key={domain}
            className={filters.domain === domain ? "active" : ""}
            aria-pressed={filters.domain === domain}
            onClick={() => setFilters({ ...defaultFilters, domain })}
          >
            {domain === "Chimie, procédés & matériaux"
              ? "Chimie & matériaux"
              : domain}
          </button>
        ))}
      </div>
      <div className="reference-filters">
        <label className="field">
          Métier, entreprise ou domaine
          <input
            type="search"
            value={filters.query}
            onChange={(event) => change("query", event.target.value)}
            placeholder="Ex. réseaux, Axians, maintenance…"
          />
        </label>
        <Filter
          label="Région"
          value={filters.region}
          onChange={(value) => change("region", value)}
          options={Object.keys(regions)}
          placeholder="Toutes les régions"
        />
        <Filter
          label="Domaine"
          value={filters.domain}
          onChange={(value) => change("domain", value)}
          options={domains}
          placeholder="Tous les domaines"
        />
        <Filter
          label="Technologie"
          value={filters.tech}
          onChange={(value) => change("tech", value)}
          options={technologies}
          placeholder="Toutes les technologies"
        />
        <Filter
          label="Niveau d’études"
          value={filters.education}
          onChange={(value) => change("education", value)}
          options={educationLevels}
          placeholder="Tous les niveaux"
        />
        <Filter
          label="Publication"
          value={filters.age}
          onChange={(value) => change("age", value)}
          options={[
            { value: "7", label: "7 derniers jours" },
            { value: "30", label: "30 derniers jours" },
          ]}
          placeholder="Toutes les dates"
        />
      </div>
      <button className="secondary" onClick={() => setFilters(defaultFilters)}>
        Effacer les filtres
      </button>
      <p className="external-date">
        Tri : publication la plus récente. Seules les offres de 45 jours maximum
        sont affichées.
      </p>
      {data.loading && <p role="status">Chargement des offres repérées…</p>}
      {data.error && (
        <div role="alert" className="form-error">
          {data.error}{" "}
          <button
            className="secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Réessayer
          </button>
        </div>
      )}
      {!data.loading && !data.error && !offers.length && (
        <p className="local-note">
          Aucun lien repéré ne correspond aux filtres sélectionnés. Essayez un
          autre domaine ou effacez les filtres.
        </p>
      )}
      <div className="external-grid">
        {offers.map((offer) => (
          <article className="external-card" key={offer.id}>
            <div className="external-company-heading">
              <CompanyLogo
                company={{ ...offer.company, website: offer.companyWebsite }}
                size={40}
              />
              <p className="external-company">{offer.company.name}</p>
            </div>
            <h3>
              <button onClick={() => open(offer)}>{offer.title}</button>
            </h3>
            <p>
              <MapPin size={15} aria-hidden="true" /> {offer.location.label} ·{" "}
              {offer.location.region}
            </p>
            <div className="tags">
              <span>{offer.contract}</span>
              {offer.education.map((level) => (
                <span key={level}>{level}</span>
              ))}
            </div>
            <p className="external-summary">{offer.summary}</p>
            <p className="external-date">
              Publication source : {date(offer.publishedAt)}
            </p>
            <div className="external-actions">
              <button className="secondary" onClick={() => open(offer)}>
                Description détaillée
              </button>
              <a
                href={offer.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Annonce officielle <ExternalLink size={15} />
              </a>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <Dialog title={selected.title} close={() => setSelected(null)}>
          <p>
            <strong>{selected.company.name}</strong> · {selected.location.label}{" "}
            · {selected.location.region}
          </p>
          <p className="local-note">
            Synthèse éditoriale d’après l’annonce officielle. Consultez la
            source pour les conditions de candidature.
          </p>
          <h3>Le contexte du stage</h3>
          <p>{selected.summary}</p>
          <h3>Les missions</h3>
          <ul>
            {selected.missions.map((mission) => (
              <li key={mission}>{mission}</li>
            ))}
          </ul>
          <h3>Profil et compétences</h3>
          <p>{selected.profile}</p>
          <div className="tags">
            {selected.technologies.map((tech) => (
              <span key={tech}>{tech}</span>
            ))}
          </div>
          <h3>L’entreprise</h3>
          <p>{selected.companySummary}</p>
          {selected.companyWebsite && (
            <a
              href={selected.companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
            >
              Site officiel du groupe <ExternalLink size={14} />
            </a>
          )}
          <h3>Conditions et provenance</h3>
          <dl>
            <dt>Contrat</dt>
            <dd>{selected.contract}</dd>
            <dt>Durée</dt>
            <dd>{selected.duration || "Non précisée dans cette synthèse"}</dd>
            <dt>Début</dt>
            <dd>
              {selected.startDateLabel || "Non précisé dans cette synthèse"}
            </dd>
            <dt>Rémunération</dt>
            <dd>
              {selected.compensation || "Non précisée dans cette synthèse"}
            </dd>
            <dt>Publication affichée par la source</dt>
            <dd>{date(selected.publishedAt)}</dd>
            <dt>Contact RH</dt>
            <dd>
              Aucun contact publié dans cette synthèse ; candidature sur le site
              employeur.
            </dd>
            <dt>Source</dt>
            <dd>{selected.sourceName}</dd>
          </dl>
          <a
            className="primary external-apply"
            href={selected.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir l’annonce et candidater chez l’employeur{" "}
            <ExternalLink size={17} />
          </a>
          <div className="report-reference">
            {reported ? (
              <p role="status" className="local-note">
                Signalement transmis au responsable du site. Merci.
              </p>
            ) : reporting ? (
              <ReportForm
                offer={selected}
                onSent={() => {
                  setReporting(false);
                  setReported(true);
                }}
              />
            ) : (
              <button className="secondary" onClick={() => setReporting(true)}>
                Signaler une offre fermée ou incorrecte
              </button>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
