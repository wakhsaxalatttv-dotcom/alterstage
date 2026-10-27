import React, { useEffect, useRef } from "react";
import {
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Leaf,
  Bell,
  Building2,
  MapPin,
  Bookmark,
  ExternalLink,
  X,
} from "lucide-react";
import { VerifiedBadge } from "./CatalogueParts";
import { regionOf, freshness } from "./domain";
const date = (value) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Non fournie";
export function Filter({ label, value, onChange, options, placeholder }) {
  return (
    <label className="field">
      {label}
      <span className="select-wrap">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value || o} value={o.value || o}>
              {o.label || o}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  );
}
export function Empty({ icon: Icon, title, text, action, label, secondary }) {
  return (
    <div className="empty">
      <div className="empty-illustration">
        <span className="empty-dot d1" />
        <span className="empty-dot d2" />
        <div>
          <Icon size={30} strokeWidth={1.5} />
        </div>
        <span className="mini-leaf">
          <Leaf size={16} />
        </span>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="secondary" onClick={action}>
        {label} <ArrowUpRight size={16} />
      </button>
      {secondary && (
        <button className="text-button" onClick={secondary}>
          <Bell size={15} /> Enregistrer ma recherche
        </button>
      )}
    </div>
  );
}
export function Offer({ offer: o, favorite, toggle, details, company }) {
  return (
    <article className="offer-card">
      <div className="offer-top">
        <span className="company-avatar">
          {o.company.logoUrl ? (
            <img
              src={o.company.logoUrl}
              loading="lazy"
              decoding="async"
              width="42"
              height="42"
              alt=""
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          ) : (
            <Building2 size={23} />
          )}
        </span>
        <div>
          <button className="company-link" onClick={company}>
            {o.company.name}
          </button>
          <p>
            <MapPin size={13} />
            {o.location.label || "Lieu non fourni"}
            {regionOf(o) && ` · ${regionOf(o)}`}
          </p>
        </div>
        <button
          className={"favorite " + (favorite ? "saved" : "")}
          aria-label={
            favorite ? "Retirer des favoris" : "Enregistrer en favoris"
          }
          aria-pressed={favorite}
          onClick={toggle}
        >
          <Bookmark size={20} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <h3>
        <button onClick={details}>{o.title}</button>
      </h3>
      <div className="tags">
        <span>{o.contract}</span>
        {o.domain && <span>{o.domain}</span>}
        {o.education.map((e) => (
          <span key={e}>{e}</span>
        ))}
        {o.sponsored && <span>Sponsorisée</span>}
      </div>
      <VerifiedBadge offer={o} />
      {o.technologies?.length > 0 && (
        <div className="tech-tags">
          {o.technologies.slice(0, 6).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="offer-meta">
        <span>Publiée le {date(o.publishedAt)}</span>
        <span>{freshness(o)}</span>
      </div>
      <p className="muted">
        Dernière vérification :{" "}
        {o.lastVerifiedAt ? date(o.lastVerifiedAt) : "non effectuée"}
      </p>
      <div className="offer-bottom">
        <a href={o.sourceUrl} target="_blank" rel="noreferrer">
          {o.source} <ExternalLink size={13} />
        </a>
        <button onClick={details}>
          Voir l’offre <ArrowRight size={16} />
        </button>
        <a href={o.applicationUrl} target="_blank" rel="noreferrer">
          Candidater <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  );
}
export function Dialog({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current,
      prev = document.activeElement;
    el.showModal();
    const dismiss = (e) => {
      if (e.target === el) close();
    };
    el.addEventListener("click", dismiss);
    return () => {
      el.removeEventListener("click", dismiss);
      el.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog aria-label={title} ref={ref} onCancel={close}>
      <div className="dialog-header">
        <h2>{title}</h2>
        <button onClick={close} aria-label="Fermer la fenêtre">
          <X size={22} />
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
