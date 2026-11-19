import React, { useCallback, useEffect, useState } from "react";
import { useCandidate } from "./CandidateContext";
import { domains, contracts } from "../shared/catalog";
export const applicationStates = {
  intent: "À confirmer",
  not_applied: "Pas encore postulé",
  applied: "Candidature envoyée",
  contacted: "Appel ou contact reçu",
  interview: "Entretien",
  offer: "Proposition reçue",
  hired: "Embauché",
  rejected: "Refus",
  withdrawn: "Candidature retirée",
};
const date = (s) =>
  s
    ? new Date(s).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const fields = (form) => Object.fromEntries(new FormData(form));
const https = (value) => {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};
function Field({ label, ...props }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
function Loading() {
  return (
    <div aria-label="Chargement du compte" aria-busy="true">
      <div className="candidate-skeleton" />
      <div className="candidate-skeleton" />
    </div>
  );
}
export function AccountPanel({ initialTab = "applications" }) {
  const c = useCandidate(),
    [mode, setMode] = useState("login"),
    [tab, setTab] = useState(initialTab),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => setTab(initialTab), [initialTab]);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!c.ready) return <Loading />;
  const cb = c.callback;
  return (
    <section className="candidate-panel">
      {error && (
        <div className="candidate-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="candidate-success" role="status">
          {message}
        </div>
      )}
      {!c.config.enabled ? (
        <div className="candidate-box">
          <h2>Votre espace candidat arrive bientôt</h2>
          <p>
            Les comptes ne sont pas encore disponibles. Vous pouvez continuer à
            consulter les offres et à candidater sur les sites des employeurs.
          </p>
          <a href="/">Rechercher des offres</a>
        </div>
      ) : (
        <>
          {cb && (
            <div className="candidate-box">
              <h2>
                {cb.unsubscribe
                  ? "Arrêter les alertes e-mail"
                  : "Votre lien de connexion"}
              </h2>
              {cb.error ? (
                <p role="alert">{cb.error}</p>
              ) : (
                <>
                  <p>
                    {cb.unsubscribe
                      ? "Vous ne recevrez plus les e-mails de nouvelles offres. Vos recherches resteront disponibles dans votre compte."
                      : "Continuez pour ouvrir votre espace sécurisé."}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        if (cb.unsubscribe) {
                          const [id, token] = cb.unsubscribe.split(".");
                          await c.api("/unsubscribe", {
                            method: "POST",
                            body: { id, token },
                          });
                          setMessage("Les alertes e-mail sont désactivées.");
                        } else {
                          c.adopt(
                            await c.api("/session", {
                              method: "POST",
                              body: cb,
                            }),
                          );
                        }
                        c.clearCallback();
                      })
                    }
                  >
                    {cb.unsubscribe
                      ? "Confirmer le désabonnement"
                      : "Continuer"}
                  </button>
                </>
              )}
            </div>
          )}
          {!c.user ? (
            <div className="candidate-box">
              <div
                className="candidate-tabs"
                role="tablist"
                aria-label="Accès au compte"
              >
                {[
                  ["login", "Se connecter"],
                  ["register", "Créer un compte"],
                  ["recover", "Mot de passe oublié"],
                  ["resend", "Renvoyer la confirmation"],
                ].map(([id, label]) => (
                  <button
                    role="tab"
                    aria-selected={mode === id}
                    key={id}
                    onClick={() => {
                      setMode(id);
                      setError("");
                      setMessage("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <h2>
                {mode === "register"
                  ? "Votre compte Offres Fraîches"
                  : mode === "login"
                    ? "Heureux de vous retrouver"
                    : mode === "recover"
                      ? "Réinitialiser votre mot de passe"
                      : "Confirmer votre e-mail"}
              </h2>
              <p>
                Suivez vos candidatures et retrouvez vos recherches sur tous vos
                appareils. La consultation des offres reste accessible sans
                compte.
              </p>
              <form
                className="candidate-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const b = fields(e.currentTarget);
                  act(async () => {
                    if (mode === "login") {
                      c.adopt(
                        await c.api("/login", { method: "POST", body: b }),
                      );
                    } else {
                      const d = await c.api("/" + mode, {
                        method: "POST",
                        body: { ...b, acceptPrivacy: b.acceptPrivacy === "on" },
                      });
                      setMessage(d.message);
                    }
                  });
                }}
              >
                {mode === "register" && (
                  <>
                    <Field
                      label="Prénom"
                      name="firstName"
                      autoComplete="given-name"
                      maxLength={120}
                      required
                    />
                    <Field
                      label="Nom"
                      name="lastName"
                      autoComplete="family-name"
                      maxLength={120}
                      required
                    />
                  </>
                )}
                <Field
                  label="Adresse e-mail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
                {["login", "register"].includes(mode) && (
                  <Field
                    label={
                      mode === "register"
                        ? "Mot de passe — 12 caractères minimum"
                        : "Mot de passe"
                    }
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    minLength={mode === "register" ? 12 : undefined}
                    maxLength={128}
                    required
                  />
                )}
                {mode === "register" && (
                  <>
                    <label className="candidate-check">
                      <input type="checkbox" name="acceptPrivacy" required />
                      J’ai pris connaissance des informations sur mes données
                      ci-dessous.
                    </label>
                    <small>
                      La confirmation de votre adresse e-mail est obligatoire.
                      Aucun abonnement aux alertes e-mail n’est activé par
                      défaut.
                    </small>
                  </>
                )}
                <button
                  className="primary"
                  disabled={
                    busy ||
                    (mode === "register" && !c.config.registrationEnabled)
                  }
                >
                  {busy
                    ? "Veuillez patienter…"
                    : mode === "login"
                      ? "Se connecter"
                      : mode === "register"
                        ? "Créer mon compte"
                        : "Envoyer le lien"}
                </button>
                {mode === "register" && !c.config.registrationEnabled && (
                  <p>Les inscriptions sont momentanément indisponibles.</p>
                )}
              </form>
            </div>
          ) : (
            <>
              <div className="candidate-box candidate-actions">
                <div>
                  <strong>Bonjour {c.user.firstName || "et bienvenue"}</strong>
                  <p className="candidate-meta">
                    {c.user.email} · E-mail confirmé
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await c.api("/logout", { method: "POST" });
                      c.adopt({});
                    })
                  }
                >
                  Se déconnecter
                </button>
              </div>
              <div
                className="candidate-tabs"
                role="tablist"
                aria-label="Mon espace"
              >
                {[
                  ["applications", "Mes candidatures"],
                  ["alerts", "Mes alertes"],
                  ["notifications", "Nouveautés"],
                  ["profile", "Mon profil"],
                ].map(([id, label]) => (
                  <button
                    role="tab"
                    aria-selected={tab === id}
                    key={id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {c.recovery ? (
                <div className="candidate-box">
                  <h2>Choisir un nouveau mot de passe</h2>
                  <PasswordForm
                    recovery
                    act={act}
                    busy={busy}
                    c={c}
                    setMessage={setMessage}
                  />
                </div>
              ) : tab === "applications" ? (
                <Applications />
              ) : tab === "alerts" ? (
                <Alerts />
              ) : tab === "notifications" ? (
                <Notifications />
              ) : (
                <div className="candidate-box">
                  <h2>Vos informations</h2>
                  <form
                    className="candidate-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const b = fields(e.currentTarget);
                      act(async () => {
                        await c.api("/profile", { method: "PATCH", body: b });
                        await c.refresh();
                        setMessage("Profil mis à jour.");
                      });
                    }}
                  >
                    <Field
                      label="Prénom"
                      name="firstName"
                      defaultValue={c.user.firstName}
                      maxLength={120}
                      autoComplete="given-name"
                      required
                    />
                    <Field
                      label="Nom"
                      name="lastName"
                      defaultValue={c.user.lastName}
                      maxLength={120}
                      autoComplete="family-name"
                      required
                    />
                    <button className="primary" disabled={busy}>
                      Enregistrer
                    </button>
                  </form>
                  <hr />
                  <h2>Changer de mot de passe</h2>
                  <PasswordForm
                    act={act}
                    busy={busy}
                    c={c}
                    setMessage={setMessage}
                  />
                  <hr />
                  <h2>Vos données</h2>
                  <p>
                    Vous pouvez télécharger vos informations et supprimer votre
                    compte avec son historique.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const data = await c.api("/export");
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(data, null, 2)], {
                            type: "application/json",
                          }),
                        );
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "offres-fraiches-mes-donnees.json";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      })
                    }
                  >
                    Télécharger mes données
                  </button>
                  <details className="candidate-danger">
                    <summary>Supprimer mon compte</summary>
                    <p>
                      Cette action supprime définitivement votre profil, vos
                      alertes et votre suivi des candidatures.
                    </p>
                    <form
                      className="candidate-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const b = fields(e.currentTarget);
                        act(async () => {
                          await c.api("/", { method: "DELETE", body: b });
                          c.adopt({});
                          setMessage("Votre compte a été supprimé.");
                        });
                      }}
                    >
                      <Field
                        label="Confirmer votre mot de passe"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                      />
                      <label className="candidate-check">
                        <input type="checkbox" required />
                        Je confirme la suppression définitive de mon compte.
                      </label>
                      <button className="secondary" disabled={busy}>
                        Supprimer définitivement mon compte
                      </button>
                    </form>
                  </details>
                </div>
              )}
            </>
          )}
        </>
      )}
      <details className="candidate-box">
        <summary>Informations sur vos données</summary>
        <p>
          Vos nom, prénom et adresse e-mail servent à gérer votre compte.
          Supabase gère votre authentification et le hachage des mots de passe ;
          aucun mot de passe en clair n’est enregistré dans le site. Vos
          candidatures, notes, recherches et notifications sont rattachées à
          votre compte.
        </p>
        <p>
          Le suivi des candidatures repose sur vos confirmations. Les employeurs
          ne transmettent pas automatiquement l’avancement. Vos données restent
          conservées jusqu’à leur suppression avec votre compte. Les e-mails de
          nouveautés sont facultatifs et peuvent être désactivés. Les e-mails de
          confirmation et de récupération servent à sécuriser votre accès.
        </p>
        <p>
          Des compteurs agrégés mesurent les pages consultées et les comptes
          connectés actifs. Ils ne permettent pas d’identifier chaque visiteur
          anonyme. L’accès aux offres reste libre.
        </p>
      </details>
    </section>
  );
}
function PasswordForm({ recovery = false, act, busy, c, setMessage }) {
  return (
    <form
      className="candidate-form"
      onSubmit={(e) => {
        e.preventDefault();
        const b = fields(e.currentTarget);
        act(async () => {
          const d = await c.api("/password", { method: "POST", body: b });
          c.adopt({});
          setMessage(d.message);
        });
      }}
    >
      {!recovery && (
        <Field
          label="Mot de passe actuel"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      )}
      <Field
        label="Nouveau mot de passe — 12 caractères minimum"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        required
      />
      <button className="primary" disabled={busy}>
        Modifier le mot de passe
      </button>
    </form>
  );
}
function Applications() {
  const { api } = useCandidate(),
    [rows, setRows] = useState([]),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      setError("");
      try {
        const d = await api("/applications?page=" + p);
        setRows((old) =>
          p === 1 ? d.applications : [...old, ...d.applications],
        );
        setPage(p);
        setMore(d.hasMore);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    load();
    const change = () => load();
    window.addEventListener("candidate-updated", change);
    return () => window.removeEventListener("candidate-updated", change);
  }, [load]);
  return (
    <>
      {error && (
        <p className="candidate-error" role="alert">
          {error}
        </p>
      )}
      <div className="candidate-box">
        <h2>Votre tableau de suivi</h2>
        <p>
          Confirmez vos candidatures, puis renseignez les réponses reçues. Les
          états et les dates de relance sont vos repères personnels ; aucune
          relance n’est envoyée à l’employeur.
        </p>
      </div>
      {loading && page === 1 ? (
        <Loading />
      ) : rows.length ? (
        rows.map((row) => (
          <Application
            key={row.id}
            row={row}
            onChanged={() => load()}
            api={api}
          />
        ))
      ) : (
        <div className="candidate-box">
          <p>
            Aucune candidature suivie. Depuis une offre, ouvrez le lien de
            candidature ; à votre retour, indiquez si vous avez postulé.
          </p>
          <a href="/">Consulter les offres</a>
        </div>
      )}
      {more && (
        <button
          className="secondary"
          disabled={loading}
          onClick={() => load(page + 1)}
        >
          Afficher la suite
        </button>
      )}
    </>
  );
}
function Application({ row, api, onChanged }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [events, setEvents] = useState(null);
  const action = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const s = row.snapshot || {},
    unconfirmed = ["intent", "not_applied"].includes(row.status),
    next = row.next_action_at
      ? new Date(
          new Date(row.next_action_at).getTime() -
            new Date(row.next_action_at).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <article className="candidate-box">
      <span className="candidate-state">{applicationStates[row.status]}</span>
      <h2>{s.title}</h2>
      <p>
        {s.company?.name} ·{" "}
        {s.location?.label || s.location?.city || "Lieu non renseigné"}
      </p>
      <p className="candidate-meta">
        {row.applied_at
          ? "Candidature confirmée le " + date(row.applied_at)
          : "Lien consulté le " + date(row.last_clicked_at)}
      </p>
      {https(s.applicationUrl || s.sourceUrl) && (
        <p>
          <a
            href={https(s.applicationUrl || s.sourceUrl)}
            target="_blank"
            rel="noreferrer"
          >
            Revoir l’annonce chez l’employeur ↗
          </a>{" "}
          <small>La fiche peut avoir changé depuis votre candidature.</small>
        </p>
      )}
      {error && (
        <p className="candidate-error" role="alert">
          {error}
        </p>
      )}
      {row.status === "intent" ? (
        <div className="candidate-actions">
          <strong>Avez-vous postulé ?</strong>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              action(() =>
                api("/applications/" + row.id + "/confirm", {
                  method: "POST",
                  body: { applied: true },
                }),
              )
            }
          >
            Oui, j’ai postulé
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              action(() =>
                api("/applications/" + row.id + "/confirm", {
                  method: "POST",
                  body: { applied: false },
                }),
              )
            }
          >
            Pas encore
          </button>
        </div>
      ) : (
        !unconfirmed && (
          <form
            className="candidate-form"
            onSubmit={(e) => {
              e.preventDefault();
              const b = fields(e.currentTarget);
              action(() =>
                api("/applications/" + row.id, {
                  method: "PATCH",
                  body: {
                    ...b,
                    nextActionAt: b.nextActionAt
                      ? new Date(b.nextActionAt).toISOString()
                      : null,
                  },
                }),
              );
            }}
          >
            <label>
              Avancement
              <select
                aria-label="Avancement"
                name="status"
                defaultValue={row.status}
              >
                {Object.entries(applicationStates)
                  .filter(([id]) => !["intent", "not_applied"].includes(id))
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Notes personnelles
              <textarea name="note" defaultValue={row.note} maxLength={4000} />
            </label>
            <Field
              label="Prochaine action — repère personnel"
              type="datetime-local"
              name="nextActionAt"
              defaultValue={next}
            />
            <button className="primary" disabled={busy}>
              Enregistrer le suivi
            </button>
          </form>
        )
      )}
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !events)
            api("/applications/" + row.id + "/events")
              .then((d) => setEvents(d.events))
              .catch((e) => setError(e.message));
        }}
      >
        <summary>Historique</summary>
        {events ? (
          <ul className="candidate-history">
            {events.length ? (
              events.map((e) => (
                <li key={e.id}>
                  <strong>{applicationStates[e.status] || e.status}</strong> ·{" "}
                  {date(e.created_at)}
                  {e.note && <p>{e.note}</p>}
                </li>
              ))
            ) : (
              <li>Aucune évolution enregistrée.</li>
            )}
          </ul>
        ) : (
          <p>Chargement…</p>
        )}
      </details>
    </article>
  );
}
function Alerts() {
  const { api, config } = useCandidate(),
    [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api("/alerts")
        .then((d) => setRows(d.alerts))
        .catch((e) => setError(e.message)),
    [api],
  );
  useEffect(() => {
    load();
  }, [load]);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && (
        <p className="candidate-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="candidate-success">
          {message}
        </p>
      )}
      <div className="candidate-box">
        <h2>Une recherche, des nouveautés</h2>
        <p>
          Les nouvelles offres importées après la création de votre alerte
          apparaissent dans « Nouveautés ». Jusqu’à 20 recherches enregistrées.
        </p>
        <form
          className="candidate-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              b = fields(form);
            act(async () => {
              await api("/alerts", {
                method: "POST",
                body: {
                  name: b.name,
                  filters: {
                    query: b.query,
                    city: b.city,
                    domain: b.domain,
                    contract: b.contract,
                  },
                  emailEnabled: b.emailEnabled === "on",
                },
              });
              form.reset();
              setMessage(
                "Recherche enregistrée. Les prochaines offres correspondantes seront signalées.",
              );
            });
          }}
        >
          <Field
            label="Nom de la recherche"
            name="name"
            maxLength={120}
            required
          />
          <Field label="Mots-clés" name="query" maxLength={200} />
          <Field label="Ville" name="city" maxLength={200} />
          <label>
            Domaine
            <select aria-label="Domaine" name="domain">
              <option value="">Tous les domaines</option>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Contrat
            <select aria-label="Contrat" name="contract">
              <option value="">Stages et alternances</option>
              {contracts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="candidate-check">
            <input
              type="checkbox"
              name="emailEnabled"
              disabled={!config.emailAlertsEnabled}
            />
            Recevoir aussi un résumé quotidien par e-mail
          </label>
          {!config.emailAlertsEnabled && (
            <small>
              L’envoi d’e-mails n’est pas encore disponible. Les nouveautés
              restent consultables dans votre compte.
            </small>
          )}
          <button className="primary" disabled={busy}>
            Enregistrer la recherche
          </button>
        </form>
      </div>
      {rows === null ? (
        <Loading />
      ) : (
        rows.map((a) => (
          <article key={a.id} className="candidate-box">
            <h2>{a.name}</h2>
            <p>
              {Object.values(a.filters).filter(Boolean).join(" · ") ||
                "Tous les domaines, partout en France"}
            </p>
            <p className="candidate-meta">
              Créée le {date(a.created_at)} · E-mails{" "}
              {a.email_enabled ? "activés" : "désactivés"}
            </p>
            <div className="candidate-actions">
              <button
                disabled={
                  busy || (!a.email_enabled && !config.emailAlertsEnabled)
                }
                className="secondary"
                onClick={() =>
                  act(() =>
                    api("/alerts/" + a.id, {
                      method: "PATCH",
                      body: { emailEnabled: !a.email_enabled },
                    }),
                  )
                }
              >
                {a.email_enabled
                  ? "Désactiver les e-mails"
                  : "Activer les e-mails"}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(() => api("/alerts/" + a.id, { method: "DELETE" }))
                }
              >
                Supprimer la recherche
              </button>
            </div>
          </article>
        ))
      )}
    </>
  );
}
function Notifications() {
  const { api, trackClick } = useCandidate(),
    [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await api("/alerts/check", { method: "POST" });
        const d = await api("/notifications");
        if (active) setRows(d.notifications);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);
  return (
    <>
      <div className="candidate-box">
        <h2>Les nouveautés de vos recherches</h2>
        <p>
          Les 100 dernières correspondances. Consultez la fiche de l’employeur
          pour vérifier les conditions actuelles.
        </p>
      </div>
      {error && (
        <p role="alert" className="candidate-error">
          {error}
        </p>
      )}
      {rows === null && !error ? (
        <Loading />
      ) : !rows?.length ? (
        <p>Aucune nouvelle offre correspondante pour l’instant.</p>
      ) : (
        rows.map((n) => (
          <article key={n.id} className="candidate-box">
            <span className="candidate-state">
              {n.read_at ? "Consultée" : "Nouvelle"}
            </span>
            <h2>{n.snapshot.title}</h2>
            <p>{n.snapshot.company?.name}</p>
            {https(n.snapshot.applicationUrl || n.snapshot.sourceUrl) && (
              <a
                onClick={() => trackClick({ id: n.offer_id })}
                onAuxClick={(e) => {
                  if (e.button === 1) trackClick({ id: n.offer_id });
                }}
                href={https(n.snapshot.applicationUrl || n.snapshot.sourceUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Consulter chez l’employeur ↗
              </a>
            )}
            <button
              className="secondary"
              disabled={!!n.read_at}
              onClick={async () => {
                try {
                  await api("/notifications/" + n.id + "/read", {
                    method: "POST",
                  });
                  setRows((old) =>
                    old.map((x) =>
                      x.id === n.id
                        ? { ...x, read_at: new Date().toISOString() }
                        : x,
                    ),
                  );
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Marquer comme lue
            </button>
          </article>
        ))
      )}
    </>
  );
}
