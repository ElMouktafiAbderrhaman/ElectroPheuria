// src/Dashboard/Pages/Banners.jsx — Banner Management: list, status, order, preview.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { apiAssetUrl } from "../../services/api.js";
import PromoBanner from "../../Components/PromoBanner";
import ScaledFrame from "../components/ScaledFrame";
import { tr } from "../../utils/bannerUtils";
import "./Banners.css";

const STATUS_LABELS = { active: "Active", inactive: "Inactive", scheduled: "Scheduled", expired: "Expired" };
const TYPE_LABELS = { product: "Product", deal: "Deal", custom: "Custom" };
const LAYOUT_LABELS = { split: "Split", centered: "Centered", duo: "Duo offer", discount: "Big discount" };

const withImages = (b) => ({
  ...b,
  image_url: apiAssetUrl(b.image_url),
  secondary: b.secondary ? { ...b.secondary, image_url: apiAssetUrl(b.secondary.image_url) } : null,
});

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString("fr-MA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

function PreviewModal({ banner, onClose }) {
  const [lang, setLang] = useState("fr");
  const [device, setDevice] = useState("desktop");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="bn-modal" onClick={onClose} role="dialog" aria-modal="true" aria-label="Banner preview">
      <div className="bn-modal-box bn-modal-box--wide" onClick={(e) => e.stopPropagation()}>
        <div className="be-preview-bar">
          <strong>{banner.title}</strong>
          <div className="be-seg">
            {["desktop", "mobile"].map((d) => <button key={d} type="button" className={device === d ? "on" : ""} onClick={() => setDevice(d)}>{d === "desktop" ? "🖥 Desktop" : "📱 Mobile"}</button>)}
          </div>
          <div className="be-seg">
            {["fr", "en", "ar"].map((l) => <button key={l} type="button" className={lang === l ? "on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button type="button" className="bn-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={`be-preview-canvas ${device === "mobile" ? "is-mobile" : ""}`}>
          <ScaledFrame width={device === "mobile" ? 390 : 1240}>
            <PromoBanner key={lang} banner={banner} lang={lang} eager />
          </ScaledFrame>
        </div>
      </div>
    </div>
  );
}

export default function Banners() {
  const navigate = useNavigate();
  const location = useLocation();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(location.state?.flash || "");
  const [previewing, setPreviewing] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api.getAdminBanners()
      .then((data) => {
        setBanners(data.map(withImages));
        setError("");
      })
      .catch(() => setError("Could not load banners."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!flash) return;
    window.history.replaceState({}, "");
    const id = setTimeout(() => setFlash(""), 3500);
    return () => clearTimeout(id);
  }, [flash]);

  const toggle = async (b) => {
    setBusy(b.id);
    try {
      const res = await api.setBannerActive(b.id, !b.active);
      setBanners((list) => list.map((x) => (x.id === b.id ? { ...x, active: res.active, status: res.status } : x)));
    } catch {
      alert("Could not change the status.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (b) => {
    if (!confirm(`Delete the banner “${b.title}”? This cannot be undone.`)) return;
    setBusy(b.id);
    try {
      await api.deleteBanner(b.id);
      setBanners((list) => list.filter((x) => x.id !== b.id));
    } catch {
      alert("Could not delete the banner.");
    } finally {
      setBusy(null);
    }
  };

  const saveOrder = async (list) => {
    const previous = banners;
    setBanners(list);
    try {
      await api.reorderBanners(list.map((b) => b.id));
    } catch {
      setBanners(previous);
      alert("Could not save the new order.");
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= banners.length || from === to) return;
    const list = [...banners];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    saveOrder(list);
  };

  const onDrop = (targetId) => {
    if (dragId === null || dragId === targetId) return;
    move(banners.findIndex((b) => b.id === dragId), banners.findIndex((b) => b.id === targetId));
    setDragId(null);
  };

  const counts = banners.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {});
  const onHomepage = banners.filter((b) => b.status === "active" && !b.source_unavailable).length;

  return (
    <main className="bn-main">
      <header className="bn-header">
        <div>
          <h1 className="bn-title">Banner Management</h1>
          <p className="bn-muted">
            {onHomepage} banner{onHomepage !== 1 ? "s" : ""} on the homepage now · drag to change the order
          </p>
        </div>
        <div className="bn-header-actions">
          <a href="/" target="_blank" rel="noreferrer" className="bn-btn bn-btn--ghost">View homepage ↗</a>
          <Link to="/dashboard/banners/new" className="bn-btn">＋ Create banner</Link>
        </div>
      </header>

      {flash && <div className="bn-flash">{flash}</div>}

      <div className="bn-stats">
        {Object.entries(STATUS_LABELS).map(([k, l]) => (
          <div key={k} className={`bn-stat bn-stat--${k}`}><strong>{counts[k] || 0}</strong><span>{l}</span></div>
        ))}
      </div>

      {loading ? (
        <p className="bn-muted">Loading banners…</p>
      ) : error ? (
        <div className="bn-empty"><p>{error}</p><button type="button" className="bn-btn" onClick={load}>Retry</button></div>
      ) : banners.length === 0 ? (
        <div className="bn-empty">
          <div className="bn-empty-icon">🖼️</div>
          <p>No banners yet. Create your first promotion for the homepage.</p>
          <Link to="/dashboard/banners/new" className="bn-btn">＋ Create banner</Link>
        </div>
      ) : (
        <ol className="bn-list">
          {banners.map((b, i) => (
            <li
              key={b.id}
              className={`bn-item ${dragId === b.id ? "is-dragging" : ""}`}
              draggable
              onDragStart={(e) => { setDragId(b.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(b.id)}
            >
              <div className="bn-order">
                <span className="bn-grip" title="Drag to reorder">⋮⋮</span>
                <span className="bn-pos">{i + 1}</span>
                <button type="button" className="bn-icon-btn" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">▲</button>
                <button type="button" className="bn-icon-btn" disabled={i === banners.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">▼</button>
              </div>

              <div className="bn-thumb" role="button" tabIndex={0} title="Preview"
                onClick={() => setPreviewing(b)} onKeyDown={(e) => e.key === "Enter" && setPreviewing(b)}>
                <div inert>
                  <ScaledFrame width={1240}>
                    <PromoBanner banner={b} lang="fr" />
                  </ScaledFrame>
                </div>
              </div>

              <div className="bn-info">
                <div className="bn-info-top">
                  <strong className="bn-name">{b.title}</strong>
                  <span className={`bn-status bn-status--${b.status}`}>{STATUS_LABELS[b.status]}</span>
                </div>
                <p className="bn-meta">
                  <span className="bn-chip">{TYPE_LABELS[b.promotion_type]}</span>
                  <span className="bn-chip">{LAYOUT_LABELS[b.layout]}</span>
                  {b.name && <span>· {b.name}</span>}
                </p>
                <p className="bn-meta">
                  {b.start_date || b.end_date
                    ? <>🗓 {fmtDate(b.start_date) || "Now"} → {fmtDate(b.end_date) || "No end"}</>
                    : "🗓 Always on"}
                </p>
                {tr(b.headline, "fr") && <p className="bn-meta bn-headline">“{tr(b.headline, "fr").replace(/\*/g, "")}”</p>}
                {b.source_unavailable && (
                  <p className="be-warn">
                    {b.promotion_type === "deal" ? "The linked deal is deleted or inactive" : "The linked product was deleted"} — hidden from the homepage.
                  </p>
                )}
              </div>

              <div className="bn-actions">
                <label className="be-switch" title={b.active ? "Deactivate" : "Activate"}>
                  <input type="checkbox" checked={b.active} disabled={busy === b.id} onChange={() => toggle(b)} />
                  <span />{b.active ? "On" : "Off"}
                </label>
                <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => setPreviewing(b)}>Preview</button>
                <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => navigate(`/dashboard/banners/${b.id}`)}>Edit</button>
                <button type="button" className="bn-btn bn-btn--danger bn-btn--sm" disabled={busy === b.id} onClick={() => remove(b)}>Delete</button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {previewing && <PreviewModal banner={previewing} onClose={() => setPreviewing(null)} />}
    </main>
  );
}
