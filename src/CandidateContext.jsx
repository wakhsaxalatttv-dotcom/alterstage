import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "./candidate.css";
function readCallback() {
  if (location.pathname !== "/compte") return null;
  const params = new URLSearchParams(location.hash.slice(1));
  if (
    !["refresh_token", "token_hash", "unsubscribe", "error_description"].some(
      (k) => params.has(k),
    )
  )
    return null;
  history.replaceState(null, "", location.pathname);
  if (params.has("unsubscribe"))
    return { unsubscribe: params.get("unsubscribe") };
  if (params.has("error_description"))
    return {
      error: "Ce lien est invalide ou expiré. Demandez un nouvel e-mail.",
    };
  return {
    refreshToken: params.get("refresh_token"),
    tokenHash: params.get("token_hash"),
    type: params.get("type"),
  };
}

const Context = createContext(null);
export const useCandidate = () => useContext(Context);
export function CandidateProvider({ children }) {
  const [config, setConfig] = useState({ enabled: false }),
    [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState(false),
    [pending, setPending] = useState(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  const csrf = useRef(null),
    dismissed = useRef(new Set());
  const [callback, setCallback] = useState(readCallback);
  useEffect(() => {
    const onHash = () => {
      const next = readCallback();
      if (next) setCallback(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const api = useCallback(
    async (path, { body, method = "GET", ...options } = {}) => {
      const response = await fetch("/api/account" + path, {
        ...options,
        method,
        credentials: "same-origin",
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(csrf.current ? { "X-CSRF-Token": csrf.current } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Le service des comptes ne répond pas. Réessayez.");
      }
      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          csrf.current = null;
        }
        throw new Error(data.message || "La demande a échoué.");
      }
      return data;
    },
    [],
  );
  const adopt = useCallback((data) => {
    setUser(data.user || null);
    csrf.current = data.csrf || null;
    setRecovery(Boolean(data.recovery));
    dismissed.current.clear();
  }, []);
  const refresh = useCallback(async () => {
    const data = await api("/me");
    adopt(data);
    return data;
  }, [api, adopt]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await api("/config");
        if (!active) return;
        setConfig(c);
        if (c.enabled) {
          const d = await api("/me");
          if (active) adopt(d);
        }
      } catch {
        if (active)
          setNotice(
            "Les comptes sont momentanément indisponibles. La recherche d’offres reste accessible.",
          );
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, adopt]);
  const checkPending = useCallback(async () => {
    try {
      const d = await api("/applications?pending=true");
      const next = d.applications.find((a) => !dismissed.current.has(a.id));
      setPending(next || null);
    } catch {
      /* Account page exposes errors; browsing remains usable. */
    }
  }, [api]);
  useEffect(() => {
    if (!user) {
      setPending(null);
      return;
    }
    checkPending();
    const onReturn = () => {
      if (document.visibilityState === "visible") checkPending();
    };
    window.addEventListener("focus", onReturn);
    window.addEventListener("candidate-updated", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("candidate-updated", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [user, checkPending]);
  const trackClick = useCallback(
    (offer) => {
      if (!user) return;
      api("/click", {
        method: "POST",
        body: { offerId: offer.id },
        keepalive: true,
      }).catch((e) => setNotice("Suivi non enregistré : " + e.message));
    },
    [user, api],
  );
  async function confirm(applied) {
    try {
      await api("/applications/" + pending.id + "/confirm", {
        method: "POST",
        body: { applied },
      });
      dismissed.current.add(pending.id);
      setPending(null);
      setNotice(
        applied
          ? "Candidature ajoutée à votre suivi."
          : "Votre réponse est enregistrée.",
      );
      window.dispatchEvent(new Event("candidate-updated"));
      await checkPending();
    } catch (e) {
      setNotice(e.message);
    }
  }
  return (
    <Context.Provider
      value={{
        config,
        user,
        ready,
        recovery,
        callback,
        clearCallback: () => setCallback(null),
        api,
        adopt,
        refresh,
        trackClick,
        setNotice,
      }}
    >
      {children}
      {notice && (
        <aside className="candidate-toast" role="status">
          <span>{notice}</span>
          <button
            aria-label="Fermer le message du compte"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </aside>
      )}
      {pending && (
        <aside
          className="candidate-return"
          aria-label="Confirmation de candidature"
        >
          <strong>Avez-vous envoyé votre candidature ?</strong>
          <p>
            {pending.snapshot.title}
            <br />
            <span>{pending.snapshot.company?.name}</span>
          </p>
          <div className="candidate-actions">
            <button className="primary" onClick={() => confirm(true)}>
              Oui, j’ai postulé
            </button>
            <button className="secondary" onClick={() => confirm(false)}>
              Non, pas encore
            </button>
            <button
              onClick={() => {
                dismissed.current.add(pending.id);
                setPending(null);
              }}
            >
              Plus tard
            </button>
          </div>
          <small>Un clic seul ne compte jamais comme une candidature.</small>
        </aside>
      )}
    </Context.Provider>
  );
}
