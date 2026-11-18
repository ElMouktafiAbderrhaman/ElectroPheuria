// src/Dashboard/Pages/BannerEditor.jsx — create / edit a homepage banner with a live preview.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../services/api.js";
import PromoBanner from "../../Components/PromoBanner";
import ScaledFrame from "../components/ScaledFrame";
import { BANNER_LANGS } from "../../utils/bannerUtils";
import { formatPrice } from "../../utils/dealPricing";
import {
  COLOR_PRESETS, LAYOUT_OPTIONS, autoTitle, draftFromRaw, emptyDraft, emptySecondary,
  payloadFromDraft, previewBanner, sourceFacts, suggestCopy,
} from "../bannerDraft";
import "./Banners.css";

const LANG_LABELS = { fr: "FR", en: "EN", ar: "AR" };
const MAX_IMAGE_CHARS = 3.5 * 1024 * 1024;

/** Resize to at most 1400px and re-encode (WebP keeps transparency; JPEG as fallback). */
function compressBannerImage(file, maxWidth = 1400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL("image/webp", 0.85);
        if (!url.startsWith("data:image/webp")) {
          url = file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
        }
        if (url.length > MAX_IMAGE_CHARS) url = canvas.toDataURL("image/jpeg", 0.7);
        resolve(url);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** One translatable field with FR / EN / AR inputs. */
function TextField({ label, value, onChange, lang, multiline, max, hint, placeholder }) {
  const Input = multiline ? "textarea" : "input";
  return (
    <label className="be-field">
      <span className="be-label">
        {label}
        <span className="be-filled">
          {BANNER_LANGS.map((l) => (
            <i key={l} className={value?.[l]?.trim() ? "on" : ""} title={`${LANG_LABELS[l]} filled`}>{LANG_LABELS[l]}</i>
          ))}
        </span>
      </span>
      <Input
        className="be-input"
        dir={lang === "ar" ? "rtl" : "ltr"}
        value={value?.[lang] || ""}
        maxLength={max}
        rows={multiline ? 3 : undefined}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
      />
      {hint && <span className="be-hint">{hint}</span>}
    </label>
  );
}

/** Searchable list of products or deals. */
function SourcePicker({ type, items, value, onChange }) {
  const [q, setQ] = useState("");
  const list = items.filter((it) => !q || it.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="be-picker">
      <input className="be-input" placeholder={`Search ${type === "deal" ? "deals" : "products"}…`} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="be-picker-list">
        {list.length === 0 && <p className="be-hint" style={{ padding: 12 }}>Nothing found.</p>}
        {list.map((it) => {
          const f = sourceFacts(type, it);
          return (
            <button type="button" key={it.id} className={`be-pick ${String(value) === String(it.id) ? "is-selected" : ""}`} onClick={() => onChange(it)}>
              {f.image ? <img src={f.image} alt="" /> : <span className="be-pick-ph">🛍️</span>}
              <span className="be-pick-name">
                {it.name}
                {!f.active && <em className="be-warn-inline"> · inactive</em>}
              </span>
              <span className="be-pick-price">
                {f.original_price ? <s>{formatPrice(f.original_price)}</s> : null} {formatPrice(f.promotional_price)} MAD
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FactsCard({ type, item }) {
  const f = sourceFacts(type, item);
  if (!f) return null;
  const offer =
    f.offer_type === "bogo_fixed" ? `1+1 · 2nd for ${formatPrice(f.second_item_price)} MAD`
    : f.offer_type === "bogo_half" ? "1+1 · 2nd at -50%"
    : f.discount_percentage ? `-${f.discount_percentage}%` : null;
  return (
    <div className="be-facts">
      {f.image ? <img src={f.image} alt="" /> : <span className="be-pick-ph">🛍️</span>}
      <div>
        <strong>{f.name}</strong>
        <p>
          {f.original_price ? <s>{formatPrice(f.original_price)} MAD</s> : null} <b>{formatPrice(f.promotional_price)} MAD</b>
          {offer && <span className="be-tag">{offer}</span>}
        </p>
        <p className="be-hint">Prices, image and link are read live from this {type}; changes to it show up in the banner automatically.</p>
        {!f.active && <p className="be-warn">This deal is inactive — the banner stays hidden until the deal is active again.</p>}
      </div>
    </div>
  );
}

function LayoutThumb({ value }) {
  const g = { fill: "currentColor" };
  return (
    <svg viewBox="0 0 120 60" className="be-layout-svg" aria-hidden="true">
      <rect x="1" y="1" width="118" height="58" rx="8" className="be-svg-frame" />
      {value === "split" && (<><rect x="10" y="14" width="46" height="8" rx="2" {...g} /><rect x="10" y="26" width="34" height="5" rx="2" opacity=".5" {...g} /><rect x="10" y="40" width="22" height="9" rx="4.5" className="be-svg-accent" /><circle cx="88" cy="30" r="17" className="be-svg-accent" opacity=".85" /></>)}
      {value === "centered" && (<><rect x="10" y="22" width="26" height="6" rx="2" {...g} /><circle cx="60" cy="30" r="17" className="be-svg-accent" opacity=".85" /><rect x="86" y="20" width="24" height="9" rx="2" className="be-svg-accent" /><rect x="88" y="34" width="22" height="7" rx="3.5" {...g} opacity=".6" /></>)}
      {value === "duo" && (<><rect x="10" y="9" width="44" height="6" rx="2" {...g} /><rect x="10" y="20" width="47" height="30" rx="5" opacity=".18" {...g} /><rect x="63" y="20" width="47" height="30" rx="5" opacity=".18" {...g} /><rect x="15" y="28" width="20" height="9" rx="2" className="be-svg-accent" /><rect x="68" y="28" width="20" height="9" rx="2" className="be-svg-accent" /></>)}
      {value === "discount" && (<><text x="8" y="44" className="be-svg-accent be-svg-text">-50%</text><rect x="66" y="18" width="22" height="5" rx="2" {...g} /><rect x="66" y="27" width="16" height="4" rx="2" {...g} opacity=".5" /><circle cx="101" cy="31" r="11" className="be-svg-accent" opacity=".85" /></>)}
    </svg>
  );
}

export default function BannerEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [draft, setDraft] = useState(() => (isEdit ? null : emptyDraft("custom")));
  const [step, setStep] = useState(isEdit ? "edit" : "type");
  const [imageChanged, setImageChanged] = useState(false);
  const [copyTouched, setCopyTouched] = useState(isEdit);
  const [lang, setLang] = useState("fr");
  const [previewLang, setPreviewLang] = useState("fr");
  const [device, setDevice] = useState("desktop");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Fresh products and deals (a deal created a moment ago must be selectable).
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getProducts(), api.getDeals()])
      .then(([p, d]) => {
        if (cancelled) return;
        setProducts(p || []);
        setDeals(d || []);
      })
      .catch(() => !cancelled && setLoadError("Could not load products and deals."));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    // Ignore a stale response, so it can never overwrite what the admin has started typing.
    let cancelled = false;
    api.getAdminBanner(id)
      .then((res) => !cancelled && setDraft(draftFromRaw(res.raw)))
      .catch(() => !cancelled && setLoadError("This banner could not be loaded."));
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // ?deal=12 (from the "feature this deal" prompt) or ?product=5 preselects the source.
  const presetDeal = params.get("deal");
  const presetProduct = params.get("product");
  useEffect(() => {
    if (isEdit || !draft || step !== "type") return;
    if (presetDeal && deals.length) {
      const deal = deals.find((x) => String(x.id) === presetDeal);
      if (deal) chooseType("deal", deal);
    } else if (presetProduct && products.length) {
      const product = products.find((x) => String(x.id) === presetProduct);
      if (product) chooseType("product", product);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetDeal, presetProduct, deals, products, draft]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setText = (field) => (value) => {
    setCopyTouched(true);
    set({ [field]: value });
  };
  const setSecondary = (patch) => setDraft((d) => ({ ...d, secondary: { ...(d.secondary || emptySecondary()), ...patch } }));

  const applySource = (type, item, { force = false } = {}) => {
    const patch = type === "deal" ? { deal_id: String(item.id) } : { product_id: String(item.id) };
    if (force || !copyTouched) {
      const copy = suggestCopy(type, item);
      if (copy) Object.assign(patch, copy);
      if (force) setCopyTouched(false);
    }
    setDraft((d) => ({ ...d, ...patch, title: d.title || item.name }));
  };

  function chooseType(type, item) {
    setDraft((d) => ({ ...emptyDraft(type), ...COLOR_PRESETS.find((p) => p.background_color === d.background_color) }));
    setCopyTouched(false);
    setStep("edit");
    if (item) setTimeout(() => applySource(type, item, { force: true }), 0);
  }

  const sourceItem = useMemo(() => {
    if (!draft) return null;
    if (draft.promotion_type === "deal") return deals.find((x) => String(x.id) === String(draft.deal_id));
    if (draft.promotion_type === "product") return products.find((x) => String(x.id) === String(draft.product_id));
    return null;
  }, [draft, deals, products]);

  const preview = useMemo(
    () => (draft ? previewBanner(draft, { products, deals }) : null),
    [draft, products, deals]
  );
  const facts = draft && draft.promotion_type !== "custom" ? sourceFacts(draft.promotion_type, sourceItem) : null;

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please choose an image file.");
    try {
      const url = await compressBannerImage(file);
      set({ image: url });
      setImageChanged(true);
    } catch {
      alert("This image could not be read.");
    }
  };

  const save = async (publish) => {
    const local = {};
    if (draft.promotion_type === "product" && !draft.product_id) local.product_id = "Choose a product.";
    if (draft.promotion_type === "deal" && !draft.deal_id) local.deal_id = "Choose a deal.";
    if (draft.promotion_type === "custom" && !BANNER_LANGS.some((l) => draft.headline[l]?.trim())) local.headline = "Write a headline in at least one language.";
    if (draft.start_date && draft.end_date && new Date(draft.end_date) <= new Date(draft.start_date)) local.end_date = "The end must be after the start.";
    if (draft.layout === "duo" && draft.secondary?.type === "deal" && !draft.secondary.deal_id) local["secondary.deal_id"] = "Choose the second deal.";
    if (draft.layout === "duo" && draft.secondary?.type === "product" && !draft.secondary.product_id) local["secondary.product_id"] = "Choose the second product.";
    setErrors(local);
    if (Object.keys(local).length) return;

    const body = payloadFromDraft(
      { ...draft, title: draft.title.trim() || autoTitle(draft, sourceItem), active: publish },
      { imageChanged }
    );
    setSaving(true);
    try {
      if (isEdit) await api.updateBanner(id, body);
      else await api.addBanner(body);
      navigate("/dashboard/banners", { state: { flash: publish ? "Banner published." : "Banner saved as draft." } });
    } catch (err) {
      const fieldErrors = err?.data?.errors || {};
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0]])));
      if (!Object.keys(fieldErrors).length) alert(`Could not save the banner: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadError && !draft) {
    return (
      <main className="bn-main">
        <div className="bn-empty"><p>{loadError}</p><Link to="/dashboard/banners" className="bn-btn">Back to banners</Link></div>
      </main>
    );
  }
  if (!draft) return <main className="bn-main"><p className="bn-muted">Loading…</p></main>;

  /* ── Step 1: how to build the promotion ── */
  if (step === "type") {
    const cards = [
      { type: "product", icon: "🎧", title: "From a product", text: "Pick a product: its name, image and price are filled in for you." },
      { type: "deal", icon: "🔥", title: "From a deal", text: "Feature an existing deal with its promo price, discount or 1+1 offer." },
      { type: "custom", icon: "✨", title: "Custom banner", text: "Write your own message, prices and link, and upload your own visual." },
    ];
    return (
      <main className="bn-main">
        <header className="bn-header">
          <div>
            <Link to="/dashboard/banners" className="bn-back">← Banners</Link>
            <h1 className="bn-title">Create a banner</h1>
            <p className="bn-muted">How do you want to build this promotion?</p>
          </div>
        </header>
        <div className="be-type-grid">
          {cards.map((c) => (
            <button key={c.type} type="button" className="be-type-card" onClick={() => chooseType(c.type)}>
              <span className="be-type-icon">{c.icon}</span>
              <strong>{c.title}</strong>
              <span>{c.text}</span>
              <span className="be-type-go">Choose →</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const s = draft.secondary;
  const typeLabel = { product: "Product banner", deal: "Deal banner", custom: "Custom banner" }[draft.promotion_type];
  const err = (k) => errors[k] && <span className="be-error">{errors[k]}</span>;

  return (
    <main className="bn-main be-main">
      <header className="bn-header">
        <div>
          <Link to="/dashboard/banners" className="bn-back">← Banners</Link>
          <h1 className="bn-title">{isEdit ? "Edit banner" : "New banner"} <span className="be-type-chip">{typeLabel}</span></h1>
        </div>
        <div className="bn-header-actions">
          {!isEdit && <button type="button" className="bn-btn bn-btn--ghost" onClick={() => setStep("type")}>Change type</button>}
          <button type="button" className="bn-btn bn-btn--ghost" disabled={saving} onClick={() => save(false)}>Save as draft</button>
          <button type="button" className="bn-btn" disabled={saving} onClick={() => save(true)}>{saving ? "Saving…" : isEdit && draft.active ? "Save & keep published" : "Publish"}</button>
        </div>
      </header>

      <div className="be-layout">
        {/* ── Live preview ── */}
        <section className="be-preview">
          <div className="be-preview-bar">
            <div className="be-seg">
              {["desktop", "mobile"].map((dv) => (
                <button key={dv} type="button" className={device === dv ? "on" : ""} onClick={() => setDevice(dv)}>{dv === "desktop" ? "🖥 Desktop" : "📱 Mobile"}</button>
              ))}
            </div>
            <div className="be-seg">
              {BANNER_LANGS.map((l) => (
                <button key={l} type="button" className={previewLang === l ? "on" : ""} onClick={() => { setPreviewLang(l); setLang(l); }}>{LANG_LABELS[l]}</button>
              ))}
            </div>
          </div>
          <div className={`be-preview-canvas ${device === "mobile" ? "is-mobile" : ""}`}>
            <ScaledFrame width={device === "mobile" ? 390 : 1240}>
              <PromoBanner key={`${previewLang}-${draft.layout}`} banner={preview} lang={previewLang} eager />
            </ScaledFrame>
          </div>
          <p className="be-hint">Live preview — exactly what customers will see. Wrap words in *stars* to colour them with the accent.</p>
        </section>

        {/* ── Form ── */}
        <section className="be-form">
          {loadError && <p className="be-warn">{loadError}</p>}

          {draft.promotion_type !== "custom" && (
            <div className="be-card">
              <h3>{draft.promotion_type === "deal" ? "Deal" : "Product"}</h3>
              {facts ? (
                <>
                  <FactsCard type={draft.promotion_type} item={sourceItem} />
                  <div className="be-row-actions">
                    <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => set(draft.promotion_type === "deal" ? { deal_id: "" } : { product_id: "" })}>Choose another</button>
                    <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => applySource(draft.promotion_type, sourceItem, { force: true })}>✨ Regenerate copy</button>
                  </div>
                </>
              ) : (
                <SourcePicker
                  type={draft.promotion_type}
                  items={draft.promotion_type === "deal" ? deals : products}
                  value={draft.promotion_type === "deal" ? draft.deal_id : draft.product_id}
                  onChange={(item) => applySource(draft.promotion_type, item)}
                />
              )}
              {err("product_id")}{err("deal_id")}
            </div>
          )}

          <div className="be-card">
            <h3>Template</h3>
            <div className="be-layouts">
              {LAYOUT_OPTIONS.map((o) => (
                <button key={o.value} type="button" className={`be-layout-opt ${draft.layout === o.value ? "is-selected" : ""}`}
                  onClick={() => set({ layout: o.value, secondary: o.value === "duo" ? (draft.secondary || emptySecondary()) : draft.secondary })}>
                  <LayoutThumb value={o.value} />
                  <strong>{o.label}</strong>
                  <span>{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="be-card">
            <div className="be-card-head">
              <h3>Text</h3>
              <div className="be-seg">
                {BANNER_LANGS.map((l) => (
                  <button key={l} type="button" className={lang === l ? "on" : ""} onClick={() => { setLang(l); setPreviewLang(l); }}>{LANG_LABELS[l]}</button>
                ))}
              </div>
            </div>
            <label className="be-field">
              <span className="be-label">Internal name</span>
              <input className="be-input" value={draft.title} maxLength={255} placeholder={autoTitle(draft, sourceItem)} onChange={(e) => set({ title: e.target.value })} />
              <span className="be-hint">Only shown in the dashboard.</span>
            </label>
            <TextField label="Headline" lang={lang} value={draft.headline} onChange={setText("headline")} max={120}
              placeholder={draft.promotion_type === "custom" ? "La 2ème presque *offerte.*" : facts?.name}
              hint={draft.promotion_type === "custom" ? "Required." : "Empty = product / deal name."} />
            {err("headline")}
            <TextField label="Secondary headline" lang={lang} value={draft.subtitle} onChange={setText("subtitle")} max={80} />
            <TextField label="Description" lang={lang} value={draft.description} onChange={setText("description")} max={400} multiline />
            <TextField label="Badge" lang={lang} value={draft.badge_text} onChange={setText("badge_text")} max={80} placeholder="-50% · OFFRE SPÉCIALE · BEST DEAL" />
            <TextField label="Button text" lang={lang} value={draft.button_text} onChange={setText("button_text")} max={80} placeholder="Commandez maintenant" hint="Empty = “Order now” in the customer’s language." />
          </div>

          {draft.layout === "duo" && s && (
            <div className="be-card">
              <h3>Second offer</h3>
              <p className="be-hint">The duo template shows the main offer and this one side by side.</p>
              <div className="be-seg be-seg--wide">
                {["deal", "product", "custom"].map((ty) => (
                  <button key={ty} type="button" className={s.type === ty ? "on" : ""} onClick={() => setSecondary({ type: ty })}>{ty}</button>
                ))}
              </div>
              {s.type !== "custom" && (() => {
                const list = s.type === "deal" ? deals : products;
                const picked = list.find((x) => String(x.id) === String(s.type === "deal" ? s.deal_id : s.product_id));
                return picked ? (
                  <>
                    <FactsCard type={s.type} item={picked} />
                    <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => setSecondary(s.type === "deal" ? { deal_id: "" } : { product_id: "" })}>Choose another</button>
                  </>
                ) : (
                  <SourcePicker type={s.type} items={list} value=""
                    onChange={(item) => setSecondary(s.type === "deal" ? { deal_id: String(item.id) } : { product_id: String(item.id) })} />
                );
              })()}
              {err("secondary.deal_id")}{err("secondary.product_id")}
              <TextField label="Small label" lang={lang} value={s.label} onChange={(v) => setSecondary({ label: v })} max={80} placeholder="ÉCOUTEURS ORAIMO · SYLO" />
              <TextField label="Heading" lang={lang} value={s.headline} onChange={(v) => setSecondary({ headline: v })} max={80} />
              <TextField label="Note" lang={lang} value={s.note} onChange={(v) => setSecondary({ note: v })} max={120} />
              <TextField label="Chip" lang={lang} value={s.badge_text} onChange={(v) => setSecondary({ badge_text: v })} max={60} />
              <div className="be-grid3">
                <label className="be-field"><span className="be-label">Original price</span><input className="be-input" type="number" min="0" step="0.01" value={s.original_price} onChange={(e) => setSecondary({ original_price: e.target.value })} /></label>
                <label className="be-field"><span className="be-label">Promo price</span><input className="be-input" type="number" min="0" step="0.01" value={s.promotional_price} onChange={(e) => setSecondary({ promotional_price: e.target.value })} /></label>
                <label className="be-field"><span className="be-label">Discount %</span><input className="be-input" type="number" min="1" max="99" value={s.discount_percentage} onChange={(e) => setSecondary({ discount_percentage: e.target.value })} /></label>
              </div>
              <label className="be-field"><span className="be-label">Link</span><input className="be-input" value={s.url} placeholder="Auto: the deal / product page" onChange={(e) => setSecondary({ url: e.target.value })} /></label>
              {err("secondary.url")}
            </div>
          )}

          <div className="be-card">
            <h3>Price & discount</h3>
            <div className="be-toggles">
              <label className="be-switch"><input type="checkbox" checked={draft.show_price} onChange={(e) => set({ show_price: e.target.checked })} /><span />Show price</label>
              <label className="be-switch"><input type="checkbox" checked={draft.show_discount} onChange={(e) => set({ show_discount: e.target.checked })} /><span />Show discount</label>
            </div>
            <div className="be-grid3">
              <label className="be-field">
                <span className="be-label">Original price</span>
                <input className="be-input" type="number" min="0" step="0.01" value={draft.original_price} placeholder={facts?.original_price ? `Auto: ${formatPrice(facts.original_price)}` : "Optional"} onChange={(e) => set({ original_price: e.target.value })} />
              </label>
              <label className="be-field">
                <span className="be-label">Promotional price</span>
                <input className="be-input" type="number" min="0" step="0.01" value={draft.promotional_price} placeholder={facts?.promotional_price ? `Auto: ${formatPrice(facts.promotional_price)}` : "Optional"} onChange={(e) => set({ promotional_price: e.target.value })} />
              </label>
              <label className="be-field">
                <span className="be-label">Discount %</span>
                <input className="be-input" type="number" min="1" max="99" value={draft.discount_percentage} placeholder={preview.discount_percentage ? `Auto: ${preview.discount_percentage}` : "Optional"} onChange={(e) => set({ discount_percentage: e.target.value })} />
              </label>
            </div>
            {err("original_price")}{err("promotional_price")}{err("discount_percentage")}
            {facts && <p className="be-hint">Leave empty to use the live {draft.promotion_type} values.</p>}
          </div>

          <div className="be-card">
            <h3>Image</h3>
            <div className="be-image-row">
              <div className="be-image-thumb">
                {preview.image_url ? <img src={preview.image_url} alt="" /> : <span>No image</span>}
              </div>
              <div className="be-image-actions">
                <label className="bn-btn bn-btn--ghost bn-btn--sm">
                  Upload image
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onImage} />
                </label>
                {draft.image && (
                  <button type="button" className="bn-btn bn-btn--ghost bn-btn--sm" onClick={() => { set({ image: null }); setImageChanged(true); }}>
                    {facts?.image ? "Use the " + draft.promotion_type + " image" : "Remove image"}
                  </button>
                )}
                <span className="be-hint">{draft.image ? "Custom image." : facts?.image ? `Using the ${draft.promotion_type} image.` : "PNG with a transparent background looks best."}</span>
              </div>
            </div>
            {err("image")}
          </div>

          <div className="be-card">
            <h3>Colours</h3>
            <div className="be-presets">
              {COLOR_PRESETS.map((p) => (
                <button key={p.name} type="button" className={`be-preset ${p.background_color === draft.background_color && p.accent_color === draft.accent_color ? "is-selected" : ""}`}
                  onClick={() => set({ background_color: p.background_color, text_color: p.text_color, accent_color: p.accent_color })}>
                  <span style={{ background: p.background_color }}><i style={{ background: p.accent_color }} /></span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="be-grid3">
              {[["background_color", "Background"], ["text_color", "Text"], ["accent_color", "Accent"]].map(([k, l]) => (
                <label key={k} className="be-field be-color">
                  <span className="be-label">{l}</span>
                  <span className="be-color-input">
                    <input type="color" value={draft[k]} onChange={(e) => set({ [k]: e.target.value })} />
                    <code>{draft[k]}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="be-card">
            <h3>Button link</h3>
            <label className="be-field">
              <input className="be-input" value={draft.button_url} placeholder={`Auto: ${facts?.url || "/products"}`} onChange={(e) => set({ button_url: e.target.value })} />
              <span className="be-hint">A page of the site (/products?category=pods) or a full https:// link. Empty = the {draft.promotion_type === "custom" ? "products page" : draft.promotion_type + " page"}.</span>
            </label>
            {err("button_url")}
          </div>

          <div className="be-card">
            <h3>Schedule</h3>
            <div className="be-grid2">
              <label className="be-field">
                <span className="be-label">Starts</span>
                <input className="be-input" type="datetime-local" value={draft.start_date} onChange={(e) => set({ start_date: e.target.value })} />
                <span className="be-hint">Empty = immediately.</span>
              </label>
              <label className="be-field">
                <span className="be-label">Ends (auto-expire)</span>
                <input className="be-input" type="datetime-local" value={draft.end_date} onChange={(e) => set({ end_date: e.target.value })} />
                <span className="be-hint">Empty = no end date.</span>
              </label>
            </div>
            {err("start_date")}{err("end_date")}
            <p className="be-hint">“Publish” makes the banner active; it appears on the homepage during this period. “Save as draft” keeps it hidden.</p>
          </div>

          <div className="be-footer-actions">
            <button type="button" className="bn-btn bn-btn--ghost" disabled={saving} onClick={() => save(false)}>Save as draft</button>
            <button type="button" className="bn-btn" disabled={saving} onClick={() => save(true)}>{saving ? "Saving…" : "Publish"}</button>
          </div>
          {Object.keys(errors).length > 0 && <p className="be-error">Please fix the highlighted fields.</p>}
        </section>
      </div>
    </main>
  );
}

