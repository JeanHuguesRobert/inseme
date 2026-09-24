import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import OleoleMap from "../components/OleoleMap.jsx";
import TimeSelector from "../components/TimeSelector.jsx";
import PresencePanel from "../components/PresencePanel.jsx";
import PresenceModeControl from "../components/PresenceModeControl.jsx";
import JohnChat from "../components/JohnChat.jsx";
import LangSwitch from "../components/LangSwitch.jsx";
import { I18nProvider, useI18n } from "../i18n/I18nContext.jsx";
import { getOrCreateSubjectRef } from "../lib/auto-presence.js";
import { PLACES_SEED } from "../lib/places-seed.js";
import { foregroundContextLocation, placeContextLocation } from "../lib/context-location.js";
import {
  localDeclareClaim,
  localGetAggregates,
  localListPlaces,
  localRevokeAll,
} from "../lib/local-presence.js";
import { classifyOleoleHost } from "../lib/facade-host.js";
import janaLogo from "../assets/jana.svg";
import "../styles/oleole.css";

const API = "/api/oleole";
const CONTEXT_API = "/api/corsica/context";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.locale ? { "X-Oleole-Locale": options.locale } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.ok && data.error) throw new Error(data.error);
  return data;
}

function mergeAggregates(serverAgg, localAgg) {
  const byPlace = new Map();
  for (const a of [...(serverAgg || []), ...(localAgg || [])]) {
    const prev = byPlace.get(a.place_ref);
    if (!prev) {
      byPlace.set(a.place_ref, { ...a, intents: { ...a.intents } });
      continue;
    }
    prev.count += a.count;
    for (const k of Object.keys(a.modalities || {})) {
      prev.modalities[k] = (prev.modalities[k] || 0) + a.modalities[k];
    }
    for (const k of ["discovery", "social", "oleole"]) {
      prev.intents[k] = (prev.intents[k] || 0) + (a.intents?.[k] || 0);
    }
  }
  return [...byPlace.values()].sort((a, b) => b.count - a.count);
}

function ProgressPanel({ aggregates, windowKey }) {
  const { t } = useI18n();
  const count = aggregates.reduce((total, item) => total + (item.count || 0), 0);
  const places = aggregates.filter((item) => item.count > 0).length;
  return (
    <section className="oleole-progress" aria-live="polite">
      <strong>{t("progress.title")}</strong>
      <p>
        {count
          ? t("progress.summary", { count, places, window: t(`time.${windowKey}`) })
          : t("progress.empty", { window: t(`time.${windowKey}`) })}
      </p>
      <small>{t("progress.note")}</small>
    </section>
  );
}

function ContextPanel({ places, selectedPlace, onChoosePlace, onUseLocation }) {
  const { t } = useI18n();
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState("");
  const location = selectedPlace?.contextLocation;

  useEffect(() => {
    if (!location) {
      setContext(null);
      return;
    }
    const controller = new AbortController();
    setStatus(t("context.loading"));
    fetch(
      `${CONTEXT_API}?lat=${location.lat}&lng=${location.lng}&precision=${encodeURIComponent(location.precision)}`,
      {
        signal: controller.signal,
      }
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "context_unavailable");
        setContext(data.context);
        setStatus("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus(t("context.unavailable"));
      });
    return () => controller.abort();
  }, [location?.lat, location?.lng, location?.precision, t]);

  const atmosphere = context?.atmosphere;
  return (
    <section className="oleole-context" aria-live="polite">
      <div className="oleole-context__head">
        <div>
          <strong>{t("context.title")}</strong>
          <p>{selectedPlace?.label || t("context.chooseHint")}</p>
        </div>
        <button type="button" className="oleole-btn oleole-btn--ghost" onClick={onUseLocation}>
          {t("context.useLocation")}
        </button>
      </div>
      <label className="oleole-context__chooser">
        <span>{t("context.choosePlace")}</span>
        <select
          value={selectedPlace?.placeRef || ""}
          onChange={(event) => onChoosePlace(event.target.value)}
        >
          <option value="">{t("context.choosePlaceholder")}</option>
          {places
            .filter((place) => place.classification === "municipality")
            .map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
        </select>
      </label>
      <p className="oleole-context__privacy">{t("context.privacy")}</p>
      {atmosphere ? (
        <div className="oleole-context__grid">
          <article className="oleole-context__card oleole-context__card--atmosphere">
            <span>{t("context.atmosphere")}</span>
            <strong>
              {Math.round(atmosphere.values.temperature_c)}°C · {atmosphere.values.condition}
            </strong>
            <small>
              {t("context.feelsLike", {
                temp: Math.round(atmosphere.values.apparent_temperature_c),
                wind: Math.round(atmosphere.values.wind_kmh),
              })}
            </small>
            <small>
              <a href={atmosphere.source.url} target="_blank" rel="noreferrer">
                {atmosphere.source.provider} · {atmosphere.freshness}
              </a>
            </small>
          </article>
          {[
            ["mobility", context.mobility],
            ["energy", context.energy],
            ["charging", context.charging],
            ["events", context.events],
          ].map(([key, item]) => (
            <article key={key} className="oleole-context__card">
              <span>{t(`context.${key}`)}</span>
              <strong>{t("context.unknown")}</strong>
              <small>{t(`context.reason.${item.reason}`)}</small>
            </article>
          ))}
        </div>
      ) : null}
      {status ? <p className="oleole-muted">{status}</p> : null}
    </section>
  );
}

const CANONICAL_URL = "https://oleole.acorsica.org/";

function InvitePanel() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState("");
  const [qr, setQr] = useState("");
  const inviteUrl = `${CANONICAL_URL}?lang=${locale}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { margin: 1, width: 240, color: { dark: "#1a1a1a" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [inviteUrl]);

  async function invite() {
    const text = t("invite.text");
    if (navigator.share) {
      try {
        await navigator.share({ title: t("meta.title"), text, url: inviteUrl });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus(t("invite.copied"));
    } catch {
      setStatus(t("invite.copyFailed"));
    }
  }

  return (
    <section className="oleole-panel oleole-invite">
      <h2 className="oleole-panel__title">{t("invite.title")}</h2>
      <p>{t("invite.intro")}</p>
      <div className="oleole-actions">
        <button type="button" className="oleole-btn oleole-btn--primary" onClick={invite}>
          {t("invite.action")}
        </button>
      </div>
      {qr ? <img className="oleole-invite__qr" src={qr} alt={t("invite.qrAlt")} /> : null}
      <small className="oleole-muted">{t("invite.note")}</small>
      {status ? (
        <p className="oleole-status" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}

function InstallPanel() {
  const { t } = useI18n();
  const promptRef = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    setInstalled(Boolean(standalone));
    const capture = (event) => {
      event.preventDefault();
      promptRef.current = event;
      setCanInstall(true);
    };
    const done = () => {
      promptRef.current = null;
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) {
      setStatus(t("install.help"));
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setStatus(t("install.accepted"));
    promptRef.current = null;
    setCanInstall(false);
  }

  return (
    <section className="oleole-panel oleole-install">
      <h2 className="oleole-panel__title">{t("install.title")}</h2>
      <p>{installed ? t("install.installed") : t("install.intro")}</p>
      {!installed ? (
        <button type="button" className="oleole-btn" onClick={install}>
          {canInstall ? t("install.action") : t("install.helpAction")}
        </button>
      ) : null}
      {status ? <small className="oleole-muted">{status}</small> : null}
    </section>
  );
}

function UpdateNotice({ registerServiceWorker }) {
  const { t } = useI18n();
  const [applyUpdate, setApplyUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof registerServiceWorker !== "function") return undefined;
    const updateServiceWorker = registerServiceWorker({
      onNeedRefresh() {
        setApplyUpdate(() => updateServiceWorker);
      },
    });
  }, [registerServiceWorker]);

  if (!applyUpdate || dismissed) return null;
  return (
    <section className="oleole-update" role="status" aria-live="polite">
      <strong>{t("update.title")}</strong>
      <p>{t("update.intro")}</p>
      <div className="oleole-actions">
        <button
          type="button"
          className="oleole-btn oleole-btn--primary"
          onClick={() => applyUpdate(true)}
        >
          {t("update.apply")}
        </button>
        <button
          type="button"
          className="oleole-btn oleole-btn--ghost"
          onClick={() => setDismissed(true)}
        >
          {t("update.later")}
        </button>
      </div>
    </section>
  );
}

function LegalPanel() {
  const { t } = useI18n();
  return (
    <section className="oleole-panel oleole-legal">
      <h2 className="oleole-panel__title">{t("legal.title")}</h2>
      <p>{t("legal.editor")}</p>
      <p>{t("legal.data")}</p>
      <p>{t("legal.host")}</p>
      <p>{t("legal.terms")}</p>
      <p>{t("legal.privacy")}</p>
      <ul className="oleole-links">
        <li>
          <a href="/legal/legal">{t("legal.legalTitle")}</a>
        </li>
        <li>
          <a href="/legal/terms">{t("legal.termsTitle")}</a>
        </li>
        <li>
          <a href="/legal/privacy">{t("legal.privacyTitle")}</a>
        </li>
        <li>
          <a href="https://acorsica.org/">{t("legal.association")}</a>
        </li>
        <li>
          <a href="https://github.com/acorsica/gouvernance">{t("legal.governance")}</a>
        </li>
      </ul>
    </section>
  );
}

function InfoPanel() {
  const { t } = useI18n();
  return (
    <>
      <section className="oleole-panel oleole-info">
        <h2 className="oleole-panel__title">{t("info.title")}</h2>
        <p>{t("info.intro")}</p>
        <p>{t("info.privacy")}</p>
        <p>{t("info.status")}</p>
      </section>
      <InvitePanel />
      <InstallPanel />
      <LegalPanel />
    </>
  );
}

function OleoleHomeInner({ registerServiceWorker }) {
  const { t, locale } = useI18n();
  const [subjectRef] = useState(() => getOrCreateSubjectRef());
  const [windowKey, setWindowKey] = useState("now");
  const [places, setPlaces] = useState(PLACES_SEED);
  const [aggregates, setAggregates] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [panel, setPanel] = useState("contribute");
  const [apiOnline, setApiOnline] = useState(null);

  const refresh = useCallback(async () => {
    const local = localGetAggregates(windowKey, locale);
    try {
      const [p, a] = await Promise.all([
        api("/places", { locale }),
        api(`/presence?window=${windowKey}&lang=${locale}`, { locale }),
      ]);
      setApiOnline(true);
      if (p.places?.length) setPlaces(p.places);
      setAggregates(mergeAggregates(a.aggregates || [], local.aggregates || []));
    } catch {
      setApiOnline(false);
      setPlaces(localListPlaces());
      setAggregates(local.aggregates || []);
    }
  }, [windowKey, locale]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("lang") !== locale) {
        url.searchParams.set("lang", locale);
        window.history.replaceState({}, "", url);
      }
    } catch {
      /* ignore */
    }
  }, [locale]);

  async function declare(payload) {
    setBusy(true);
    setFlash("");
    try {
      let result;
      try {
        const { subject_ref: _localSubjectRef, ...serverPayload } = payload;
        result = await api("/presence", {
          method: "POST",
          locale,
          body: JSON.stringify(serverPayload),
        });
        setApiOnline(true);
      } catch {
        result = localDeclareClaim({ ...payload, subject_ref: subjectRef });
        setApiOnline(false);
      }
      if (!result.ok) throw new Error((result.errors || [t("flash.failed")]).join(", "));
      setFlash(t("flash.published"));
      await refresh();
    } catch (err) {
      setFlash(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    setBusy(true);
    try {
      try {
        await api("/presence/revoke", {
          method: "POST",
          locale,
          body: JSON.stringify({ all: true }),
        });
        setApiOnline(true);
      } catch {
        localRevokeAll(subjectRef);
        setApiOnline(false);
      }
      setFlash(t("flash.revoked"));
      await refresh();
    } catch (err) {
      setFlash(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onSelectPlace(place) {
    setSelectedPlace({
      ...place,
      contextLocation: placeContextLocation(place),
      placeRef: place.id,
      label: place.name,
    });
    setFocus({ lat: place.lat, lng: place.lng, zoom: 12 });
    setPanel("contribute");
  }

  function chooseContextPlace(placeRef) {
    const place = places.find((item) => item.id === placeRef);
    if (!place) return setSelectedPlace(null);
    setSelectedPlace({
      ...place,
      contextLocation: placeContextLocation(place),
      placeRef: place.id,
      label: place.name,
    });
    setFocus({ lat: place.lat, lng: place.lng, zoom: 12 });
  }

  function useForegroundLocation() {
    if (!navigator.geolocation) {
      setFlash(t("context.geoUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = foregroundContextLocation(position.coords);
        if (!location) return setFlash(t("context.outsideCorsica"));
        setSelectedPlace({ contextLocation: location, label: t("context.nearYou") });
        setFocus({ lat: location.lat, lng: location.lng, zoom: 12 });
      },
      () => setFlash(t("context.geoDenied")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  function onMapContext(ctx) {
    if (ctx?.window) setWindowKey(ctx.window);
    if (ctx?.focus_place) {
      const p = places.find((x) => x.id === ctx.focus_place);
      if (p) {
        setSelectedPlace({
          ...p,
          contextLocation: placeContextLocation(p),
          placeRef: p.id,
          label: p.name,
        });
        setFocus({ lat: p.lat, lng: p.lng, zoom: 11 });
      }
    }
    refresh();
  }

  return (
    <div className="oleole-app" lang={locale}>
      <header className="oleole-header">
        <div className="oleole-brand">
          <img className="oleole-brand__mark" src={janaLogo} alt="" />
          <div>
            <h1 className="oleole-brand__title">{t("meta.title")}</h1>
            <p className="oleole-brand__sub">{t("brand.subtitle")}</p>
          </div>
        </div>
        <div className="oleole-header__controls">
          <LangSwitch />
          <TimeSelector value={windowKey} onChange={setWindowKey} />
        </div>
      </header>

      <main className="oleole-main">
        <section className="oleole-map-wrap" aria-label={t("map.aria")}>
          <OleoleMap
            places={places}
            aggregates={aggregates}
            focus={focus}
            onSelectPlace={onSelectPlace}
          />
        </section>

        <aside className="oleole-side">
          <UpdateNotice registerServiceWorker={registerServiceWorker} />
          <ContextPanel
            places={places}
            selectedPlace={selectedPlace}
            onChoosePlace={chooseContextPlace}
            onUseLocation={useForegroundLocation}
          />
          <nav className="oleole-tabs" aria-label={t("nav.panelsAria")}>
            {[
              ["contribute", "nav.contribute"],
              ["mode", "nav.mode"],
              ["john", "nav.john"],
              ["info", "nav.info"],
            ].map(([id, key]) => (
              <button
                key={id}
                type="button"
                className={panel === id ? "oleole-chip oleole-chip--active" : "oleole-chip"}
                onClick={() => setPanel(id)}
              >
                {t(key)}
              </button>
            ))}
          </nav>

          {panel === "contribute" && (
            <>
              <ProgressPanel aggregates={aggregates} windowKey={windowKey} />
              <PresencePanel
                places={places}
                selectedPlace={selectedPlace}
                onDeclare={declare}
                onRevokeAll={revokeAll}
                busy={busy}
              />
            </>
          )}
          {panel === "mode" && (
            <PresenceModeControl
              subjectRef={subjectRef}
              onPublish={declare}
              onPolicyChange={async (policy) => {
                const { subject_ref: _localSubjectRef, ...serverPolicy } = policy;
                try {
                  await api("/policy", {
                    method: "POST",
                    locale,
                    body: JSON.stringify(serverPolicy),
                  });
                } catch {
                  /* local policy still applies */
                }
              }}
            />
          )}
          {panel === "john" && (
            <JohnChat subjectRef={subjectRef} windowKey={windowKey} onMapContext={onMapContext} />
          )}
          {panel === "info" && <InfoPanel />}

          {flash ? (
            <p className="oleole-status" role="status">
              {flash}
            </p>
          ) : null}

          <footer className="oleole-footer">
            {apiOnline === false ? <p>{t("proto.localMode")}</p> : null}
            <p>{t("footer.blurb")}</p>
            <p className="oleole-footer__publisher">
              {classifyOleoleHost(
                typeof window !== "undefined" ? window.location.hostname : "",
                typeof window !== "undefined" ? window.location.search : ""
              ).role === "jhn_facet"
                ? t("footer.publisher.facet")
                : t("footer.publisher")}
            </p>
          </footer>
        </aside>
      </main>
    </div>
  );
}

export default function OleoleHome({ registerServiceWorker }) {
  return (
    <I18nProvider>
      <OleoleHomeInner registerServiceWorker={registerServiceWorker} />
    </I18nProvider>
  );
}
