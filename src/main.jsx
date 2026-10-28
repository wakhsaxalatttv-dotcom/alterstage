import { ReportForm } from "./ReportForm";
import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Bookmark,
  Bell,
  Leaf,
  ArrowRight,
  MapPin,
  X,
  Check,
  ShieldCheck,
  ExternalLink,
  Building2,
  Clock3,
  RotateCcw,
  ChevronDown,
  CircleHelp,
} from "lucide-react";
import { defaultFilters, regions, regionOf, selectOffers } from "./domain";
import "@fontsource-variable/inter/wght.css";
import "./styles.css";
import { useLocal } from "./storage";
import { Filter, Empty, Offer, Dialog } from "./components";
const EmployerForm = lazy(() =>
  import("./EmployerForm").then((m) => ({ default: m.EmployerForm })),
);
import { request } from "./api";
import { Companies } from "./Companies";
import { ExternalOffers } from "./ExternalOffers";
import {
  Pagination,
  Skeletons,
  AlertMatches,
  CompanyProfile,
  VerifiedBadge,
} from "./CatalogueParts";
import { domains, domainGroups } from "../shared/catalog";
const date = (value) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Non fournie";
function App() {
  const [page, setPage] = useState("search"),
    [filters, setFilters] = useState(defaultFilters),
    [filtersOpen, openFilters] = useState(false);
  const [data, setData] = useState({ status: "loading", offers: [] }),
    [reload, setReload] = useState(0),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState("");
  const [favorites, setFavorites, favError] = useLocal(
      "offres-favorites-v1",
      [],
    ),
    [alerts, setAlerts, alertError] = useLocal("offres-alerts-v1", []),
    [reports, setReports, reportError] = useLocal("offres-reports-v1", []);
  const [listPage, setListPage] = useState(1);
  useEffect(() => setListPage(1), [filters]);
  useEffect(() => {
    const controller = new AbortController();
    setData((previous) => ({ ...previous, status: "loading", offers: [] }));
    const timer = setTimeout(
      () =>
        fetch(
          "/api/offers?" + new URLSearchParams({ ...filters, page: listPage }),
          { signal: controller.signal },
        )
          .then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw new Error(d.message);
            return d;
          })
          .then(setData)
          .catch((e) => {
            if (e.name !== "AbortError")
              setData({
                status: "error",
                offers: [],
                message: e.message || "Chargement impossible.",
              });
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [reload, filters, listPage]);
  const offers = data.offers || [],
    results = offers,
    active = Object.values(filters).filter(Boolean).length;
  const change = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const toggleFav = (o) =>
    setFavorites((old) =>
      old.some((x) => x.id === o.id)
        ? old.filter((x) => x.id !== o.id)
        : [...old, o],
    );
  function createAlert() {
    setAlerts((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        filters: { ...filters },
        createdAt: new Date().toISOString(),
      },
    ]);
    setModal(null);
    setNotice("Alerte enregistrée sur cet appareil.");
  }
  function openOffer(offer) {
    setModal({ type: "offer", offer, loading: true });
    request("/api/offers/" + encodeURIComponent(offer.id))
      .then((data) =>
        setModal((current) =>
          current?.type === "offer" && current.offer.id === offer.id
            ? { type: "offer", offer: data.offer, loading: false }
            : current,
        ),
      )
      .catch((error) =>
        setModal((current) =>
          current?.type === "offer" && current.offer.id === offer.id
            ? { ...current, loading: false, error: error.message }
            : current,
        ),
      );
  }
  function navigate(next) {
    setPage(next);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const scopedFavorites = selectOffers(favorites, defaultFilters);
  const visible = page === "favorites" ? scopedFavorites : results;
  const titles = {
    spotted: "Offres repérées récentes",
    favorites: "Mes favoris",
    alerts: "Mes alertes",
    employers: "Déposer une annonce",
    companies: "Les entreprises, à la source",
  };
  const subtitles = {
    spotted:
      "Des liens employeurs et des synthèses détaillées pour élargir vos recherches.",
    favorites:
      "Les offres techniques et informatiques que vous gardez de côté, sur cet appareil.",
    alerts: "Vos recherches enregistrées, à retrouver à chaque visite.",
    employers:
      "Proposez un stage ou une alternance technique ou informatique. Publication après validation.",
    companies:
      "Explorez les sites des entreprises et retrouvez les annonces réellement publiées dans le catalogue.",
  };
  return (
    <>
      <header>
        <div className="nav wrap">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("search");
            }}
          >
            <span className="brand-icon">
              <Leaf size={22} />
            </span>
            offres fraîches<span className="beta">BÊTA</span>
          </a>
          <nav aria-label="Navigation principale">
            <button
              aria-label="Entreprises"
              className={page === "companies" ? "selected" : ""}
              onClick={() => navigate("companies")}
            >
              <Building2 size={17} />
              <span>Entreprises</span>
            </button>
            <button
              className={page === "search" ? "selected" : ""}
              onClick={() => navigate("search")}
            >
              Les offres
            </button>
            <button
              aria-label="Repérées"
              className={page === "spotted" ? "selected" : ""}
              aria-current={page === "spotted" ? "page" : undefined}
              onClick={() => navigate("spotted")}
            >
              <ExternalLink size={17} />{" "}
              <span className="spotted-label">Repérées</span>
            </button>
            <button
              aria-label="Mes favoris"
              className={page === "favorites" ? "selected" : ""}
              onClick={() => navigate("favorites")}
            >
              <Bookmark size={17} /> <span>Mes favoris</span>
              {favorites.length > 0 && <small>{favorites.length}</small>}
            </button>
            <button
              aria-label="Mes alertes"
              className={page === "alerts" ? "selected" : ""}
              onClick={() => navigate("alerts")}
            >
              <Bell size={17} />
              <span>Mes alertes</span>
            </button>
          </nav>
          <button
            aria-label="Déposer une annonce"
            className="employer-nav"
            onClick={() => navigate("employers")}
          >
            <Building2 size={17} />
            <span>Déposer une annonce</span>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      {page === "search" && (
        <section className="hero">
          <div className="wrap hero-content">
            <div className="eyebrow">LE BON DÉPART, À LA BONNE SOURCE</div>
            <h1>
              Votre avenir mérite
              <br />
              des offres <span>fraîches.</span>
            </h1>
            <p>
              Informatique, réseaux, industrie et chimie. Trouvez une offre et
              candidatez directement auprès de l’employeur.
            </p>
          </div>
        </section>
      )}
      <main className="wrap">
        {page === "search" && (
          <>
            <form className="search-box" onSubmit={(e) => e.preventDefault()}>
              <Search size={22} />
              <label className="sr-only" htmlFor="search">
                Rechercher un métier, une entreprise ou un domaine
              </label>
              <input
                id="search"
                placeholder="Un métier, une entreprise, un mot-clé…"
                value={filters.query}
                onChange={(e) => change("query", e.target.value)}
              />
              <button className="primary" type="submit">
                Rechercher <ArrowRight size={17} />
              </button>
            </form>
            <p>
              <a
                href="#reperees"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("spotted");
                }}
              >
                Voir les stages repérés chez les entreprises et leurs
                descriptions détaillées ↓
              </a>
            </p>
            <div className="mobile-filter">
              <button
                onClick={() => openFilters(!filtersOpen)}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={17} /> Filtres{" "}
                {active > 0 && `(${active})`}
                <ChevronDown size={15} />
              </button>
            </div>
          </>
        )}
        {page !== "search" && (
          <div className="page-title">
            <div className="eyebrow">
              {["favorites", "alerts"].includes(page)
                ? "VOTRE ESPACE LOCAL"
                : "TECHNIQUE & INFORMATIQUE"}
            </div>
            <h1>{titles[page]}</h1>
            <p>{subtitles[page]}</p>
          </div>
        )}
        {(notice || favError || alertError || reportError) && (
          <div role="status" className="notice">
            {notice || favError || alertError || reportError}
            <button
              aria-label="Fermer le message"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page === "employers" ? (
          <Suspense fallback={<Skeletons />}>
            <EmployerForm />
          </Suspense>
        ) : page === "spotted" ? (
          <ExternalOffers />
        ) : page === "companies" ? (
          <Companies
            offers={offers}
            openCompany={(company) => setModal({ type: "company", company })}
          />
        ) : page === "alerts" ? (
          <>
            <div className="local-note">
              <Bell size={20} />
              <p>
                Les alertes sont enregistrées dans ce navigateur.{" "}
                <strong>
                  Aucune notification ni aucun e-mail n’est envoyé lorsque le
                  navigateur est fermé.
                </strong>
              </p>
            </div>
            {alerts.length ? (
              <div className="alerts-list">
                {alerts.map((a) => (
                  <article className="alert-card" key={a.id}>
                    <div>
                      <span className="eyebrow">RECHERCHE ENREGISTRÉE</span>
                      <h2>{a.filters.query || "Stages et alternances"}</h2>
                      <p>
                        {Object.entries(a.filters)
                          .filter(([k, v]) => v && k !== "query")
                          .map(([k, v]) =>
                            k === "age" ? `Moins de ${v} jours` : v,
                          )
                          .join(" · ") || "Tous les filtres"}{" "}
                        · Créée le {date(a.createdAt)}
                      </p>
                      <AlertMatches filters={a.filters} />
                    </div>
                    <div className="alert-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setFilters({ ...defaultFilters, ...a.filters });
                          navigate("search");
                        }}
                      >
                        Voir les offres <ArrowRight size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setAlerts((old) => old.filter((x) => x.id !== a.id))
                        }
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={Bell}
                title="Votre prochaine piste commence ici"
                text="Enregistrez une recherche pour retrouver facilement les offres qui vous intéressent."
                action={() => navigate("search")}
                label="Créer une recherche"
              />
            )}
          </>
        ) : (
          <div className={"layout " + (page === "favorites" ? "full" : "")}>
            {page === "search" && (
              <aside className={filtersOpen ? "filters open" : "filters"}>
                <div className="filter-heading">
                  <h2>
                    <SlidersHorizontal size={18} /> Affiner la recherche
                  </h2>
                  <button
                    title="Effacer les filtres"
                    aria-label="Effacer les filtres"
                    onClick={() => setFilters({ ...defaultFilters })}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <label className="field">
                  Ville
                  <input
                    value={filters.city || ""}
                    onChange={(e) => change("city", e.target.value)}
                    placeholder="Paris, Nantes, Lille…"
                  />
                </label>
                <Filter
                  label="Technologie mentionnée"
                  value={filters.tech || ""}
                  onChange={(v) => change("tech", v)}
                  options={data.facets?.technologies || []}
                  placeholder="Toutes les technologies"
                />
                <Filter
                  label="Région"
                  value={filters.region}
                  onChange={(v) => change("region", v)}
                  options={Object.keys(regions)}
                  placeholder="Toute la France"
                />
                <Filter
                  label="Famille de métiers"
                  value={filters.group || ""}
                  onChange={(v) => {
                    setFilters((f) => ({ ...f, group: v, domain: "" }));
                  }}
                  options={Object.keys(domainGroups)}
                  placeholder="Technique & informatique"
                />
                <Filter
                  label="Domaine"
                  value={filters.domain}
                  onChange={(v) => change("domain", v)}
                  options={
                    filters.group ? domainGroups[filters.group] : domains
                  }
                  placeholder="Toutes les spécialités"
                />
                <Filter
                  label="Niveau d’études"
                  value={filters.education}
                  onChange={(v) => change("education", v)}
                  options={data.facets?.education || []}
                  placeholder="Tous les niveaux"
                />
                <fieldset>
                  <legend>Type de contrat</legend>
                  {[
                    "Stage",
                    "Apprentissage",
                    "Contrat de professionnalisation",
                  ].map((v) => (
                    <label className="radio" key={v}>
                      <input
                        type="checkbox"
                        checked={filters.contract === v}
                        onChange={() =>
                          change("contract", filters.contract === v ? "" : v)
                        }
                      />
                      {v}
                    </label>
                  ))}
                </fieldset>
                <Filter
                  label="Date de publication"
                  value={filters.age}
                  onChange={(v) => change("age", v)}
                  options={[
                    { value: "1", label: "Dernières 24 heures" },
                    { value: "7", label: "7 derniers jours" },
                    { value: "14", label: "14 derniers jours" },
                    { value: "30", label: "30 derniers jours" },
                  ]}
                  placeholder="Toutes les dates"
                />
                <button
                  className="reset"
                  onClick={() => setFilters({ ...defaultFilters })}
                >
                  Effacer tous les filtres
                </button>
                <div className="sidebar-tip">
                  <Leaf size={21} />
                  <strong>Une recherche, une longueur d’avance.</strong>
                  <p>
                    Gardez vos critères sous la main en créant une alerte
                    locale.
                  </p>
                  <button onClick={() => setModal({ type: "alert" })}>
                    Créer mon alerte <ArrowRight size={15} />
                  </button>
                </div>
              </aside>
            )}
            <section className="results" aria-label="Résultats de recherche">
              <div className="results-heading">
                <div>
                  <h2>
                    {page === "favorites"
                      ? "Vos offres sauvegardées"
                      : "Les dernières opportunités"}
                  </h2>
                  <p aria-live="polite">
                    {data.status === "loading" && page === "search"
                      ? "Chargement des offres…"
                      : `${page === "favorites" ? visible.length : data.total || 0} offre${(page === "favorites" ? visible.length : data.total || 0) !== 1 ? "s" : ""}${page === "favorites" ? " enregistrée" + (visible.length !== 1 ? "s" : "") : " correspondant" + (data.total !== 1 ? "es" : "e") + " à votre recherche"}`}
                  </p>
                </div>
                <span className="sort">
                  <Clock3 size={15} /> Plus récentes <ChevronDown size={14} />
                </span>
              </div>
              {page === "search" && (
                <div
                  className={
                    "source-banner " + (data.status === "error" ? "error" : "")
                  }
                >
                  <span className="source-symbol">
                    <ShieldCheck size={21} />
                  </span>
                  <div>
                    <strong>
                      {data.status === "loading"
                        ? "Connexion à la source…"
                        : data.status === "connected"
                          ? "Offres d’entreprises et annonces reçues de sources autorisées"
                          : data.status === "error"
                            ? "La source est indisponible"
                            : "La transparence commence ici"}
                    </strong>
                    <p>
                      {data.status === "unconfigured"
                        ? "Catalogue direct des entreprises."
                        : data.status === "loading"
                          ? "Nous recherchons les dernières offres disponibles."
                          : data.message}
                    </p>
                  </div>
                  <button
                    aria-label={
                      data.status === "error"
                        ? "Réessayer"
                        : "Comprendre les sources"
                    }
                    onClick={() =>
                      data.status === "error"
                        ? setReload((x) => x + 1)
                        : setModal({ type: "sources" })
                    }
                  >
                    {data.status === "error" ? (
                      <RotateCcw size={18} />
                    ) : (
                      <CircleHelp size={18} />
                    )}
                  </button>
                </div>
              )}
              {page === "favorites" && favorites.length > 0 && (
                <p className="local-note">
                  Les favoris sont des copies locales : leur disponibilité
                  actuelle n’est pas confirmée. Consultez toujours la source.
                </p>
              )}
              {data.status === "loading" && page === "search" ? (
                <Skeletons />
              ) : visible.length ? (
                <div className="offer-list">
                  {[...visible]
                    .sort(
                      (a, b) =>
                        (Date.parse(b.publishedAt) || 0) -
                        (Date.parse(a.publishedAt) || 0),
                    )
                    .map((o) => (
                      <Offer
                        key={o.id}
                        offer={o}
                        favorite={favorites.some((f) => f.id === o.id)}
                        toggle={() => toggleFav(o)}
                        details={() => openOffer(o)}
                        company={() =>
                          setModal({ type: "company", company: o.company })
                        }
                      />
                    ))}
                </div>
              ) : (
                <Empty
                  icon={page === "favorites" ? Bookmark : Search}
                  title={
                    page === "favorites"
                      ? "Vos coups de cœur, bientôt ici"
                      : active
                        ? "Aucune offre ne correspond pour le moment"
                        : "Les bonnes offres méritent une vraie source."
                  }
                  text={
                    page === "favorites"
                      ? "Utilisez le signet sur une offre pour la retrouver ici."
                      : active
                        ? "Essayez des critères plus larges. Vous pouvez aussi enregistrer cette recherche pour la retrouver plus tard."
                        : "Aucune annonce n’a encore été validée. Explorez les sites d’entreprises ou proposez une offre. Ici, seuls les stages et alternances techniques et informatiques sont publiés."
                  }
                  action={() =>
                    page === "favorites"
                      ? navigate("search")
                      : active
                        ? setFilters({ ...defaultFilters })
                        : navigate("companies")
                  }
                  label={
                    page === "favorites"
                      ? "Explorer les offres"
                      : active
                        ? "Effacer les filtres"
                        : "Explorer les sites d’entreprises"
                  }
                  secondary={
                    page === "search" ? () => setModal({ type: "alert" }) : null
                  }
                />
              )}
              {page === "search" && data.status === "connected" && (
                <Pagination
                  page={data.page || 1}
                  pages={data.pages || 1}
                  total={data.total || 0}
                  onChange={setListPage}
                />
              )}
              <div className="trust-strip">
                <ShieldCheck size={18} />
                <p>
                  Pas d’annonce inventée. Pas de date devinée.{" "}
                  <strong>La source fait foi.</strong>
                </p>
                <button onClick={() => setModal({ type: "trust" })}>
                  Notre engagement <ArrowUpRight size={14} />
                </button>
              </div>
            </section>
          </div>
        )}
        {page === "search" && (
          <section className="bottom-banner">
            <div className="bottom-icon">
              <Bell size={26} />
            </div>
            <div>
              <h2>Retrouvez vos critères de recherche.</h2>
              <p>
                Enregistrez vos critères et retrouvez-les à votre prochaine
                visite.
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => setModal({ type: "alert" })}
            >
              Créer une alerte locale <ArrowRight size={17} />
            </button>
          </section>
        )}
      </main>
      <footer className="wrap">
        <div className="footer-brand">
          <Leaf size={18} /> offres fraîches{" "}
          <span>Stages et alternances en France.</span>
        </div>
        <div>
          <button onClick={() => setModal({ type: "sources" })}>
            Sources & fiabilité
          </button>
          <span>Gratuit, et sans compte candidat.</span>
        </div>
      </footer>
      {modal && (
        <Dialog
          close={() => setModal(null)}
          title={
            modal.type === "offer"
              ? modal.offer.title
              : modal.type === "company"
                ? modal.company.name
                : modal.type === "alert"
                  ? "Enregistrer cette recherche"
                  : modal.type === "report"
                    ? "Signaler cette offre"
                    : modal.type === "sources"
                      ? "Des offres à la source"
                      : "La confiance se construit avec des faits"
          }
        >
          {modal.type === "sources" && (
            <>
              <div className="status-label">
                Sources directes · validation manuelle
              </div>
              <h3>Les entreprises, sans intermédiaire inutile</h3>
              <p>
                Le catalogue contient des annonces reçues d’API autorisées,
                explicitement non vérifiées, ainsi que des dépôts d’entreprises
                et des annonces reprises de leurs sites officiels avec
                autorisation. Des flux JSON ou RSS autorisés peuvent être
                configurés côté serveur ; leurs annonces passent par la
                modération. France Travail reste désactivé. Seuls les stages et
                alternances techniques et informatiques sont acceptés.
              </p>
              <p>
                Google aide à trouver une annonce ; un résultat de recherche
                n’est jamais une preuve de sa disponibilité. La page originale,
                la date, l’entreprise et les droits doivent être contrôlés avant
                publication. Seuls les flux explicitement autorisés sont
                récupérés ; aucun site n’est scrappé.
              </p>
              <p>
                Les boîtes génériques de recrutement sont affichées uniquement
                si elles sont publiques, autorisées et accompagnées de leur page
                de provenance. Aucun contact personnel n’est collecté.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setModal(null);
                  navigate("companies");
                }}
              >
                Explorer les entreprises <ArrowRight size={16} />
              </button>
              <p className="muted">
                Une vérification est datée et ponctuelle. Après sept jours sans
                nouveau contrôle, l’offre repasse « À vérifier ». Les offres
                expirées sont retirées de la recherche.
              </p>
            </>
          )}
          {modal.type === "trust" && (
            <>
              <p>
                Chaque annonce conserve sa source originale et les dates
                réellement fournies. La validation humaine porte sur la
                disponibilité du poste, l’entreprise et l’autorisation de
                republication. Elle ne garantit pas que le recrutement restera
                ouvert.
              </p>
              <ul className="principles">
                <li>
                  <Check /> Aucune annonce fictive dans le catalogue.
                </li>
                <li>
                  <Check /> Les dates de publication viennent des sources
                  officielles.
                </li>
                <li>
                  <Check /> Seules les offres de 45 jours maximum sont
                  affichées.
                </li>
                <li>
                  <Check /> Aucun contact personnel collecté sur le web.
                </li>
              </ul>
              <p>
                La recherche est gratuite. Les favoris et alertes sont stockés
                uniquement sur cet appareil. Les nouveaux signalements sont
                transmis au responsable du site. Vous pouvez supprimer les
                favoris et alertes depuis leurs écrans ; effacer les données du
                site supprime l’ensemble.
              </p>
              {reports.length > 0 && (
                <button
                  className="secondary"
                  onClick={() => {
                    setReports([]);
                    setNotice("Signalements locaux supprimés.");
                  }}
                >
                  Supprimer mes {reports.length} ancien(s) signalement(s)
                  local(aux)
                </button>
              )}
            </>
          )}
          {modal.type === "alert" && (
            <>
              <p>Vos critères actuels seront conservés dans ce navigateur.</p>
              <div className="criteria">
                {Object.values(filters).filter(Boolean).join(" · ") ||
                  "Tous les stages et alternances techniques et informatiques, partout en France"}
              </div>
              <div className="local-note">
                <Bell size={22} />
                <p>
                  Cette alerte locale ne peut pas envoyer de notifications
                  lorsque le navigateur est fermé. Retrouvez ses correspondances
                  dans « Mes alertes ».
                </p>
              </div>
              <button className="primary" onClick={createAlert}>
                Enregistrer l’alerte <Check size={17} />
              </button>
            </>
          )}
          {modal.type === "offer" && modal.loading && <Skeletons count={1} />}
          {modal.type === "offer" && modal.error && (
            <>
              <p role="alert" className="form-error">
                {modal.error}
              </p>
              <p>
                La disponibilité actuelle de cette offre ne peut pas être
                confirmée.
              </p>
              <a href={modal.offer.sourceUrl} target="_blank" rel="noreferrer">
                Consulter la source originale
              </a>
            </>
          )}
          {modal.type === "offer" && !modal.loading && !modal.error && (
            <>
              <div className="tags">
                <span>
                  {modal.offer.acceptedContracts?.join(" / ") ||
                    modal.offer.contract}
                </span>
              </div>
              <button
                className="company-link"
                onClick={() =>
                  setModal({ type: "company", company: modal.offer.company })
                }
              >
                <Building2 size={17} />
                {modal.offer.company.name}
                <ArrowUpRight size={16} />
              </button>
              <dl>
                <dt>Lieu</dt>
                <dd>
                  {modal.offer.location.label || "Non fourni"}{" "}
                  {regionOf(modal.offer)}
                </dd>
                <dt>Domaine</dt>
                <dd>{modal.offer.domain || "Non fourni"}</dd>
                <dt>Formation</dt>
                <dd>{modal.offer.education.join(", ") || "Non fournie"}</dd>
                {modal.offer.duration && (
                  <>
                    <dt>Durée du contrat</dt>
                    <dd>{modal.offer.duration}</dd>
                  </>
                )}
                {modal.offer.startsAt && (
                  <>
                    <dt>Début</dt>
                    <dd>{date(modal.offer.startsAt)}</dd>
                  </>
                )}
                <dt>Publication</dt>
                <dd>{date(modal.offer.publishedAt)}</dd>
                <dt>Source</dt>
                <dd>{modal.offer.source}</dd>
              </dl>
              <VerifiedBadge offer={modal.offer} />
              <h3>Description du poste</h3>
              <p className="description">
                {modal.offer.description ||
                  "Information non fournie par la source."}
              </p>
              {modal.offer.missions?.length > 0 && (
                <>
                  <h3>Missions</h3>
                  <ul>
                    {modal.offer.missions.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              {modal.offer.skills.length > 0 && (
                <>
                  <h3>Compétences demandées</h3>
                  <ul>
                    {modal.offer.skills.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {modal.offer.technologies?.length > 0 && (
                <>
                  <h3>Technologies mentionnées</h3>
                  <div className="tags">
                    {modal.offer.technologies.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <p className="muted">
                    Extraction lexicale du texte. Ces mentions ne constituent
                    pas des compétences exigées ni une stack d’entreprise
                    certifiée.
                  </p>
                </>
              )}
              <PublicContacts contacts={modal.offer.publicContacts} />
              <div className="dialog-actions">
                <a
                  className="primary"
                  href={modal.offer.applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Candidater sur le site officiel <ExternalLink size={16} />
                </a>
                <a
                  href={modal.offer.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la source originale
                </a>
                <button onClick={() => toggleFav(modal.offer)}>
                  {favorites.some((f) => f.id === modal.offer.id)
                    ? "Retirer des favoris"
                    : "Ajouter aux favoris"}
                </button>
                <button
                  onClick={() =>
                    setModal({ type: "report", offer: modal.offer })
                  }
                >
                  Signaler une offre fermée ou incorrecte
                </button>
              </div>
            </>
          )}
          {modal.type === "company" && (
            <CompanyProfile company={modal.company} openOffer={openOffer} />
          )}
          {modal.type === "report" && (
            <ReportForm
              offer={modal.offer}
              onSent={() => {
                setNotice(
                  "Signalement transmis au responsable du site. Merci.",
                );
                setModal(null);
              }}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
function PublicContacts({ contacts = [] }) {
  return contacts.length > 0 ? (
    <section className="public-contacts">
      <h3>Contact public de recrutement</h3>
      {contacts.map((c) => (
        <div key={c.value}>
          <a href={`mailto:${c.value}`}>{c.value}</a>
          <a href={c.provenance} target="_blank" rel="noreferrer">
            Provenance du contact <ExternalLink size={13} />
          </a>
        </div>
      ))}
      <p className="muted">
        Boîte générique fournie par une source autorisée. Vous pouvez aussi
        candidater par le lien officiel.
      </p>
    </section>
  ) : null;
}
createRoot(document.getElementById("root")).render(<App />);
