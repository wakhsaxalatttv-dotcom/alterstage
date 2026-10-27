import React, { useEffect, useState } from "react";
import { Building2, ArrowUpRight, ExternalLink, Search } from "lucide-react";
import { companyTypes, companySizes, companyTags } from "../shared/company";
import { googleSearch } from "../shared/catalog";
import { request } from "./api";
import { Filter } from "./components";
import { Pagination, Skeletons } from "./CatalogueParts";
export function Companies({ openCompany }) {
  const [filters, setFilters] = useState({
      query: "",
      city: "",
      type: "",
      size: "",
      tag: "",
    }),
    [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState("");
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
          ESN, spécialistes réseau et télécoms, cloud, ingénierie et entreprises
          locales. Une fiche de recherche n’est ni un partenariat ni une offre
          d’emploi. Les tailles, agences, rythmes et contacts non fournis ne
          sont pas inventés.
        </p>
      </div>
      <div className="company-filters">
        <label className="field">
          Entreprise
          <input
            value={filters.query}
            onChange={(e) => change("query", e.target.value)}
            placeholder="Nom d’entreprise"
          />
        </label>
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
        <button
          className="reset"
          onClick={() => {
            setFilters({ query: "", city: "", type: "", size: "", tag: "" });
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
                <article className="directory-card" key={c.id}>
                  <div className="directory-logo" aria-hidden="true">
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        loading="lazy"
                        decoding="async"
                        width="45"
                        height="45"
                        alt=""
                        onError={(e) => {
                          e.currentTarget.hidden = true;
                        }}
                      />
                    ) : (
                      c.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <span className="directory-label">
                    {c.researchLead ? "PISTE À VÉRIFIER" : "FICHE CONTRÔLÉE"}
                  </span>
                  <h2>{c.name}</h2>
                  {c.type && <span className="company-type">{c.type}</span>}
                  <p>{c.sector}</p>
                  <div className="tags">
                    {c.tags?.slice(0, 3).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  {c.location && <p>{c.location}</p>}
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
                    <a href={c.website} target="_blank" rel="noreferrer">
                      Site de l’entreprise
                      <ExternalLink size={13} />
                    </a>
                    {c.researchLead && (
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
                </article>
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
