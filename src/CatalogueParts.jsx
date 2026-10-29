import { CompanyHostingBadge } from "./CompanyHostingBadge";
import { CompanyLogo } from "./CompanyLogo";
import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { request } from "./api";
export function Pagination({ page, pages, total, onChange }) {
  return pages > 1 ? (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
        Précédent
      </button>
      <span>
        Page {page} sur {pages} · {total} résultats
      </span>
      <button
        className="secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Suivant
        <ChevronRight size={16} />
      </button>
    </nav>
  ) : null;
}
export function Skeletons({ count = 3 }) {
  return (
    <div
      className="skeleton-list"
      role="status"
      aria-label="Chargement des résultats"
    >
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-block short" />
          <div className="skeleton-block" />
          <div className="skeleton-block medium" />
          <div className="skeleton-block short" />
        </div>
      ))}
    </div>
  );
}
export function VerifiedBadge({ offer }) {
  const elapsed = Date.now() - Date.parse(offer.lastVerifiedAt);
  const valid =
    offer.status === "active" &&
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    elapsed < 7 * 86400000;
  if (!valid) return null;
  return (
    <span
      className="verified-badge"
      title={`Source et périmètre technique contrôlés le ${new Date(offer.lastVerifiedAt).toLocaleDateString("fr-FR")}. Ce contrôle ne garantit pas l’ouverture future du recrutement.`}
    >
      <ShieldCheck size={13} />
      Offre vérifiée
      {offer.technicalReviewAt ? " · périmètre technique relu" : ""}
    </span>
  );
}
export function AlertMatches({ filters }) {
  const [count, setCount] = useState(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    request(
      "/api/offers?" + new URLSearchParams({ ...filters, pageSize: "1" }),
      { signal: ctrl.signal },
    )
      .then((d) => setCount(d.total))
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => ctrl.abort();
  }, [JSON.stringify(filters)]);
  return (
    <span>
      {error
        ? "Correspondances temporairement indisponibles"
        : count === null
          ? "Recherche des correspondances…"
          : `${count} correspondance(s) dans le catalogue actuel`}
    </span>
  );
}
export function CompanyProfile({ company: initial, openOffer, browseOffers }) {
  const [page, setPage] = useState(1),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError("");
    request(`/api/companies/${encodeURIComponent(initial.id)}?page=${page}`, {
      signal: ctrl.signal,
    })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => ctrl.abort();
  }, [initial.id, page]);
  if (error)
    return (
      <p role="alert" className="form-error">
        {error}
      </p>
    );
  if (!data) return <Skeletons count={1} />;
  const c = data.company;
  return (
    <>
      <div className="profile-logo">
        <CompanyLogo company={c} />
      </div>
      <CompanyHostingBadge company={c} />
      {c.identityCheckedAt && (
        <p className="muted">
          Identité sourcée le{" "}
          {new Date(c.identityCheckedAt).toLocaleDateString("fr-FR")}.
        </p>
      )}
      {c.description && <p className="description">{c.description}</p>}
      <dl>
        {[
          ["Secteur", c.sector],
          ["Domaine déclaré", !c.website ? c.declaredDomain : null],
          ["Type", c.type, "type"],
          ["Taille", c.size, "size"],
          ["Localisation déclarée", c.location, "location"],
          ["Agences", c.locations?.join(" · "), "locations"],
          ["Stack déclarée", c.stack?.join(" · "), "stack"],
          ["Rythme indiqué par la source", c.rhythm, "rhythm"],
          ["Labels / certifications", c.certifications?.join(" · ")],
        ]
          .filter(([, v]) => v)
          .map(([label, value, field]) => (
            <React.Fragment key={label}>
              <dt>{label}</dt>
              <dd>
                {value}
                {field && c.fieldEvidence?.[field] && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={c.fieldEvidence[field].sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Consulté le ${new Date(c.fieldEvidence[field].checkedAt).toLocaleDateString("fr-FR")}`}
                    >
                      Source
                    </a>
                  </>
                )}
              </dd>
            </React.Fragment>
          ))}
      </dl>
      {c.hostingReview && (
        <section className="hosting-criteria">
          <h3>Critères d’accueil documentés</h3>
          <p>{c.hostingReview.acceptedContracts.join(" · ")}</p>
          {!!c.hostingReview.rhythms?.length && (
            <p>Rythmes : {c.hostingReview.rhythms.join(" · ")}</p>
          )}
          <p className="muted">
            Contrôle du{" "}
            {new Date(c.hostingReview.reviewedAt).toLocaleDateString("fr-FR")}
            {c.hostingStatus !== "reviewed" ? " — à renouveler" : ""} ·{" "}
            <a
              href={c.hostingReview.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source des conditions d’accueil
            </a>
          </p>
        </section>
      )}
      {!!c.currentContracts?.length && (
        <p>
          Contrats observés dans les offres récentes :{" "}
          {c.currentContracts.join(" · ")}
        </p>
      )}
      <div className="tags">
        {c.tags?.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <p className="muted">
        Les champs absents ne sont pas fournis. Une technologie extraite d’une
        annonce ne devient pas la stack déclarée de l’entreprise.
      </p>
      <div className="review-links">
        {c.identitySourceUrl && (
          <a href={c.identitySourceUrl} target="_blank" rel="noreferrer">
            Source de l’identité
            <ExternalLink size={14} />
          </a>
        )}
        {c.website && (
          <a href={c.website} target="_blank" rel="noreferrer">
            Site entreprise
            <ExternalLink size={14} />
          </a>
        )}
        {c.profileSourceUrl && (
          <a href={c.profileSourceUrl} target="_blank" rel="noreferrer">
            Provenance de la fiche
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <p className="muted">
        Dernier contrôle de la fiche :{" "}
        {c.profileVerifiedAt
          ? new Date(c.profileVerifiedAt).toLocaleDateString("fr-FR")
          : "non effectué"}
        . Aucun partenariat n’est présumé.
      </p>
      {c.publicContacts?.length > 0 && (
        <>
          <h3>Contact générique public</h3>
          {c.publicContacts.map((contact) => (
            <p key={contact.value}>
              <a href={`mailto:${contact.value}`}>{contact.value}</a> ·{" "}
              <a href={contact.provenance} target="_blank" rel="noreferrer">
                Provenance
              </a>
            </p>
          ))}
        </>
      )}
      <h3>{data.total} offre(s) liée(s) dans le catalogue actuel</h3>
      {data.total > 0 && browseOffers && (
        <button className="secondary" onClick={() => browseOffers(c)}>
          Voir ses offres dans la recherche
          <ArrowRight size={14} />
        </button>
      )}
      {data.offers.map((o) => (
        <button
          className="company-offer"
          key={o.id}
          onClick={() => openOffer(o)}
        >
          {o.title}
          <ArrowRight size={16} />
        </button>
      ))}
      {!data.total && (
        <p>Aucune offre de cette entreprise dans le catalogue actuel.</p>
      )}
      <Pagination {...data} onChange={setPage} />
    </>
  );
}
