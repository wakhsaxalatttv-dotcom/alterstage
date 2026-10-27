import React from "react";
import { Building2, ArrowUpRight, Search, ExternalLink } from "lucide-react";
import { directory, googleSearch } from "../shared/catalog";
export function Companies({ offers, openCompany }) {
  const actual = [
    ...new Map(offers.map((o) => [o.company.id, o.company])).values(),
  ];
  return (
    <>
      <div className="local-note">
        <Building2 size={22} />
        <p>
          Les entreprises ci-dessous sont des pistes de recherche sur leurs
          propres sites,{" "}
          <strong>
            pas des partenaires ni des recruteurs dont des offres ont été
            vérifiées ici
          </strong>
          . Les liens Google ouvrent une recherche : ils n’importent aucune
          annonce.
        </p>
      </div>
      {actual.length > 0 && (
        <>
          <h2 className="section-title">
            Entreprises avec une annonce dans le catalogue
          </h2>
          <div className="company-grid">
            {actual.map((c) => (
              <article className="directory-card" key={c.id}>
                <Building2 />
                <h2>{c.name}</h2>
                {c.sector && <p>{c.sector}</p>}
                <p>
                  {offers.filter((o) => o.company.id === c.id).length} offre(s)
                  dans le catalogue
                </p>
                <button className="secondary" onClick={() => openCompany(c)}>
                  Voir l’entreprise <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      <h2 className="section-title">Explorer les sites d’entreprises</h2>
      <p className="muted">
        Domaines d’activité indicatifs pour orienter votre recherche. Aucun
        poste, contact ou partenariat n’est présumé. Ces pages n’ont pas pu être
        contrôlées depuis cet environnement.
      </p>
      <div className="company-grid">
        {directory.map((c) => (
          <article className="directory-card" key={c.id}>
            <div className="directory-logo" aria-hidden="true">
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="directory-label">PISTE DE RECHERCHE</span>
            <h2>{c.name}</h2>
            <p>{c.focus}</p>
            <div className="directory-actions">
              <a
                className="secondary"
                href={c.website}
                target="_blank"
                rel="noreferrer"
              >
                Site de l’entreprise <ExternalLink size={14} />
              </a>
              <a href={googleSearch(c)} target="_blank" rel="noreferrer">
                <Search size={14} /> Rechercher ses stages et alternances
              </a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
