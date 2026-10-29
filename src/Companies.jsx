import { CompanyHostingBadge } from "./CompanyHostingBadge";
import { AnimatedCard } from "./AnimatedCard";
import { CompanyLogo } from "./CompanyLogo";
import React, { useEffect, useState, useId } from "react";
import { Building2, ArrowUpRight, ExternalLink, Search } from "lucide-react";
import {
  companyTypes,
  companySizes,
  companyTags,
  hostingFilters,
} from "../shared/company";
import { contracts, googleSearch } from "../shared/catalog";
import { request } from "./api";
import { Filter } from "./components";
import { Pagination, Skeletons } from "./CatalogueParts";
export function Companies({ openCompany, browseOffers }) {
  const [filters, setFilters] = useState({
      query: "",
      city: "",
      type: "",
      size: "",
      tag: "",
      hosting: "",
      contract: "",
    }),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const advancedCount = Object.entries(filters).filter(
    ([key, value]) => key !== "query" && value,
  ).length;
  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError("");
    const timer = setTimeout(
      () =>
        request("/api/companies?" + new URLSearchParams({ ...filters, page }), {
          signal: ctrl.signal,
        })
          .then(setData)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [JSON.stringify(filters), page]);
  const change = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  return (
    <>
      <div className="local-note">
        <Building2 size={22} />
        <p>
          Découvrez les entreprises et leurs expertises. Filtrez les accueils
          contrôlés ou les offres récentes ; les rythmes, effectifs et contacts
          non confirmés restent masqués.
        </p>
      </div>
      <div className="company-search">
        <label className="field">
          Entreprise
          <input
            value={filters.query}
            onChange={(e) => change("query", e.target.value)}
            placeholder="Nom, expertise ou technologie"
          />
        </label>
        <button
          type="button"
          className="secondary company-filter-toggle"
          aria-label="Filtres entreprises"
          aria-controls={filtersId}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          Filtres{advancedCount ? ` (${advancedCount})` : ""}
        </button>
      </div>
      <div
        id={filtersId}
        className={`company-filters${filtersOpen ? " open" : ""}`}
      >
        <label className="field">
          Ville ou agence
          <input
            value={filters.city}
            onChange={(e) => change("city", e.target.value)}
            placeholder="Localisation renseignée"
          />
        </label>
        <Filter
          label="Type d’entreprise"
          value={filters.type}
          onChange={(v) => change("type", v)}
          options={companyTypes}
          placeholder="Tous les types"
        />
        <Filter
          label="Taille"
          value={filters.size}
          onChange={(v) => change("size", v)}
          options={companySizes}
          placeholder="Toutes les tailles"
        />
        <Filter
          label="Expertise"
          value={filters.tag}
          onChange={(v) => change("tag", v)}
          options={companyTags}
          placeholder="Tous les tags"
        />
        <Filter
          label="Accueil"
          value={filters.hosting}
          onChange={(v) => change("hosting", v)}
          options={hostingFilters}
          placeholder="Tous les statuts"
        />
        <Filter
          label="Contrat accueilli ou proposé"
          value={filters.contract}
          onChange={(v) => change("contract", v)}
          options={contracts}
          placeholder="Tous les contrats"
        />
        <button
          className="reset"
          onClick={() => {
            setFilters({
              query: "",
              city: "",
              type: "",
              size: "",
              tag: "",
              hosting: "",
              contract: "",
            });
            setPage(1);
          }}
        >
          Effacer les filtres
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!data && !error ? (
        <Skeletons />
      ) : (
        data && (
          <>
            <p className="muted" aria-live="polite">
              {data.total} entreprise(s) · informations sourcées, champs
              inconnus masqués
            </p>
            <div className="company-grid">
              {data.companies.map((c) => (
                <AnimatedCard className="directory-card" key={c.id}>
                  <CompanyLogo company={c} />
                  <span className="directory-label">
                    {c.identityCheckedAt
                      ? "IDENTITÉ SOURCÉE"
                      : c.researchLead
                        ? "PISTE À VÉRIFIER"
                        : c.profileVerifiedAt
                          ? "FICHE CONTRÔLÉE"
                          : "DONNÉES SOURCE"}
                  </span>
                  <CompanyHostingBadge company={c} />
                  <h2>{c.name}</h2>
                  {c.type && <span className="company-type">{c.type}</span>}
                  <p>{c.sector}</p>
                  <div className="tags">
                    {c.tags?.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  {c.location && <p>{c.location}</p>}
                  {c.size && <p className="muted">{c.size}</p>}
                  {!!c.currentContracts?.length && (
                    <p className="muted">
                      Contrats des offres : {c.currentContracts.join(" · ")}
                    </p>
                  )}
                  <p className="muted">
                    {c.offerCount
                      ? `${c.offerCount} offre(s) publiée(s)`
                      : "Aucune offre confirmée dans le catalogue"}
                  </p>
                  <div className="directory-actions">
                    <button
                      className="secondary"
                      onClick={() => openCompany(c)}
                    >
                      Voir la fiche
                      <ArrowUpRight size={16} />
                    </button>
                    {c.offerCount > 0 && browseOffers && (
                      <button
                        className="secondary"
                        onClick={() => browseOffers(c)}
                      >
                        Voir ses offres
                      </button>
                    )}
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noreferrer">
                        Site de l’entreprise
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {c.researchLead && c.website && (
                      <a
                        href={googleSearch({
                          ...c,
                          searchDomain: new URL(c.website).hostname,
                        })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Search size={14} />
                        Rechercher sur son site
                      </a>
                    )}
                  </div>
                </AnimatedCard>
              ))}
            </div>
            {!data.total && (
              <p className="empty-admin">
                Aucune fiche ne correspond. Essayez des critères plus larges ;
                les champs non sourcés ne sont pas devinés.
              </p>
            )}
            <Pagination {...data} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
