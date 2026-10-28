import { CompanyLogo } from "./CompanyLogo";
import { workModeLabel } from "./jobMeta";
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
import { regionOf } from "./domain";
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
        <CompanyLogo company={o.company} />
        <div className="offer-heading">
          <h3>
            <button onClick={details}>{o.title}</button>
          </h3>
          <button className="company-link" onClick={company}>
            {o.company.name}
          </button>
          <p className="offer-location">
            <MapPin size={13} aria-hidden="true" />
            {o.location.label || "Lieu non fourni"}
            {regionOf(o) && ` · ${regionOf(o)}`}
            {workModeLabel(o) && (
              <span className="work-mode">{workModeLabel(o)}</span>
            )}
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
          <Bookmark size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="tags">
        <span>
          {o.acceptedContracts?.length > 1
            ? o.acceptedContracts.join(" / ")
            : o.contract}
        </span>
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
        <time dateTime={o.publishedAt || undefined}>
          Publiée le {date(o.publishedAt)}
        </time>
      </div>
      <div className="offer-bottom">
        <a href={o.sourceUrl} target="_blank" rel="noreferrer">
          {o.source || o.sourceName || "Source originale"}{" "}
          <ExternalLink size={13} />
        </a>
        <button onClick={details}>
          Voir l’offre <ArrowRight size={16} />
        </button>
        <a
          className="apply-link"
          href={o.applicationUrl || o.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Candidater <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  );
}
export function Dialog({ title, close, children, variant }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current,
      prev = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    const dismiss = (e) => {
      if (e.target === el) close();
    };
    el.addEventListener("click", dismiss);
    return () => {
      el.removeEventListener("click", dismiss);
      el.close();
      document.body.style.overflow = previousOverflow;
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      className={variant === "drawer" ? "detail-drawer" : undefined}
      aria-label={title}
      ref={ref}
      onCancel={close}
    >
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
