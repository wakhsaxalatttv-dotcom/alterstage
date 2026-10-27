import React, { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Dialog } from "./components";
import { selectOffers, freshness } from "./domain";
import { externalOffers } from "../shared/external-offers";
const date = (value) => new Date(value).toLocaleDateString("fr-FR");
export function ExternalOffers({ filters }) {
  const [selected, setSelected] = useState(null);
  const offers = selectOffers(externalOffers, filters);
  return (
    <section
      className="external-offers"
      aria-labelledby="external-title"
      id="offres-reperees"
    >
      <div className="external-heading">
        <div>
          <p className="eyebrow">DIRECTEMENT CHEZ L’EMPLOYEUR</p>
          <h2 id="external-title">
            Stages repérés sur les sites d’entreprises
          </h2>
        </div>
        <span>
          {offers.length} lien{offers.length > 1 ? "s" : ""} avec vos filtres
        </span>
      </div>
      <p>
        Sélection éditoriale distincte du catalogue synchronisé. Synthèses
        rédigées d’après les annonces officielles, consultées le 27/10/2026.
        Disponibilité à confirmer sur le site employeur ; pas de vérification
        automatique.
      </p>
      {!offers.length && (
        <p className="local-note">
          Aucun lien repéré ne correspond aux filtres sélectionnés.
        </p>
      )}
      <div className="external-grid">
        {offers.map((offer) => (
          <article className="external-card" key={offer.id}>
            <span className="external-status">
              Lien externe · {freshness(offer)}
            </span>
            <p className="external-company">{offer.company.name}</p>
            <h3>
              <button onClick={() => setSelected(offer)}>{offer.title}</button>
            </h3>
            <p>
              <MapPin size={15} aria-hidden="true" /> {offer.location.label} ·{" "}
              {offer.location.region}
            </p>
            <div className="tags">
              <span>Stage</span>
              {offer.education.map((level) => (
                <span key={level}>{level}</span>
              ))}
            </div>
            <p>{offer.summary}</p>
            <p className="external-date">
              Publication source : {date(offer.publishedAt)}
            </p>
            <div className="external-actions">
              <button className="secondary" onClick={() => setSelected(offer)}>
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
            Synthèse éditoriale d’après l’annonce officielle.{" "}
            {freshness(selected)} : consultez la source pour confirmer la
            disponibilité et les conditions.
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
          <a
            href="https://www.safran-group.com/fr"
            target="_blank"
            rel="noopener noreferrer"
          >
            Site officiel du groupe Safran <ExternalLink size={14} />
          </a>
          <h3>Conditions et provenance</h3>
          <dl>
            <dt>Contrat</dt>
            <dd>Stage</dd>
            <dt>Publication fournie par la source</dt>
            <dd>{date(selected.publishedAt)}</dd>
            <dt>Page consultée</dt>
            <dd>{date(selected.sourceConsultedAt)}</dd>
            <dt>Dernière vérification de disponibilité</dt>
            <dd>Non effectuée</dd>
            <dt>Durée, début, rémunération et contact RH</dt>
            <dd>
              Non précisés dans cette synthèse ; consulter l’annonce officielle.
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
            Voir l’annonce et candidater chez Safran <ExternalLink size={17} />
          </a>
        </Dialog>
      )}
    </section>
  );
}
