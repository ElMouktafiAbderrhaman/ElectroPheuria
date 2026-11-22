// src/pages/Checkout.jsx
// Checkout in three steps on one page: 1. customer details → 2. order summary → CONFIRM MY ORDER.
// Amounts shown come from the server's quote (/orders/quote), and the order is sent with the
// total the customer saw: the server refuses it if that total is no longer right, so the
// amount recorded is always the amount displayed.
import { useState, useEffect, useRef } from "react";
import { useCart, cartLineKey } from "../context/CartContext";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { fbTrack, cartPayload, trackPurchase } from "../utils/fbPixel";
import { findCity } from "../utils/moroccanCities";
import { orderTotals, lineTotal, isBogoDeal, offerLabel, formatPrice } from "../utils/dealPricing";
import CitySelect from "../Components/CitySelect";
import CartLineExtras, { cartLineImage } from "../Components/CartLineExtras";
import QuantitySelector from "../Components/QuantitySelector";
import { normalizeMoroccanPhone, isValidMoroccanPhone } from "../utils/phone";
import { isBuyNowSearch, buyNowItemPath, loadBuyNowLine } from "../utils/buyNow";
import { parseQuantity } from "../utils/quantity";
import "./Checkout.css";

// The customer's details survive a refresh / an in-app browser reload (this tab only).
const DRAFT_KEY = "ElectroPheuria-checkout-draft";
function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage blocked: the form still works */
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** What the server needs to price a line (never prices or totals). */
const orderLinePayload = ({ id, name, quantity, isDeal, oldPrice, old_price, variant_id, bundle_variants }) => ({
  id,
  name,
  quantity,
  ...(variant_id ? { variant_id } : {}),
  ...(bundle_variants && Object.keys(bundle_variants).length ? { bundle_variants } : {}),
  ...(isDeal ? { isDeal: true } : {}),
  ...(oldPrice !== undefined ? { oldPrice } : {}),
  ...(old_price !== undefined ? { old_price } : {}),
});

/** "318 DH": the number stays left-to-right inside Arabic text, the currency follows the language. */
function Money({ value, negative = false }) {
  const { t } = useTranslation();
  return (
    <span className="money">
      <bdi dir="ltr">{negative ? "−" : ""}{formatPrice(value)}</bdi> {t("currency")}
    </span>
  );
}

export default function Checkout() {
  const { cart, clearCart, removeFromCart, updateQuantity, syncWithCatalog } = useCart();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [draft] = useState(readDraft);
  const [name, setName] = useState(draft.name || "");
  const [phone, setPhone] = useState(draft.phone || "");
  const [confirmPhone, setConfirmPhone] = useState(draft.confirmPhone || "");
  const [email, setEmail] = useState(draft.email || "");
  const [city, setCity] = useState(draft.city || "");
  const [cityError, setCityError] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(draft.deliveryAddress || "");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [message, setMessage] = useState("");
  // Synchronous lock: React state updates too late to stop a quick double tap.
  const submitLock = useRef(false);
  const checkoutTracked = useRef(false);
  const messageRef = useRef(null);

  // "Purchase Now" checkout: one item described by the URL (?product=12&qty=5&variant=7).
  // Otherwise the checkout shows the cart.
  const buyNow = isBuyNowSearch(searchParams);
  const buyKey = buyNow
    ? ["product", "deal", "variant", "cables"].map((k) => searchParams.get(k) || "").join("|")
    : "";
  const [buyResult, setBuyResult] = useState(null); // { key, line, error }
  const buyLoading = buyNow && buyResult?.key !== buyKey;
  const buyError = buyNow && !buyLoading ? buyResult?.error : null;
  const buyLine = buyNow && !buyLoading && buyResult?.line
    ? { ...buyResult.line, quantity: parseQuantity(searchParams.get("qty")) || 1 }
    : null;
  const lines = buyNow ? (buyLine ? [buyLine] : []) : cart;

  // ── Server quote: the exact amounts the order will record ──
  const payload = lines.map(orderLinePayload);
  const quoteKey = JSON.stringify(payload);
  const [quote, setQuote] = useState(null); // { key, data } | { key, error, status, info }
  const quoteReady = quote?.key === quoteKey && quote.data;
  const quoteProblem = quote?.key === quoteKey && quote.status === 422 ? quote.info : null;

  useEffect(() => {
    if (payload.length === 0) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.quoteOrder(payload)
        .then((data) => { if (!cancelled) setQuote({ key: quoteKey, data }); })
        .catch((err) => { if (!cancelled) setQuote({ key: quoteKey, error: true, status: err?.status, info: err?.data || {} }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // quoteKey describes the payload exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  // Local amounts (same rules as the server) show instantly; the server's replace them as soon as they arrive.
  const local = orderTotals(lines);
  const sameShape = quoteReady && quote.data.lines?.length === lines.length;
  const amounts = quoteReady
    ? { gross: quote.data.products_subtotal, discount: quote.data.discount, delivery: quote.data.delivery_fee, total: quote.data.total, items: quote.data.items }
    : { gross: local.subtotal, discount: local.discount, delivery: local.delivery, total: local.total, items: local.items };
  const lineAmounts = (item, index) => {
    const q = sameShape ? quote.data.lines[index] : null;
    if (q) return { unit: q.unit_price, subtotal: q.line_subtotal, discount: q.discount, total: q.line_total };
    const l = lineTotal(item);
    return { unit: Number(item.price), subtotal: l.subtotal, discount: l.discount, total: l.total };
  };
  const totalPrice = amounts.total;

  useEffect(() => {
    if (!buyNow) syncWithCatalog();
  }, [buyNow, syncWithCatalog]);

  useEffect(() => {
    if (!buyKey) return undefined;
    let cancelled = false;
    // Fresh price, stock and offer from the catalogue — never trusted from the link.
    loadBuyNowLine(searchParams)
      .then(({ line }) => {
        if (!cancelled) setBuyResult({ key: buyKey, line, error: null });
      })
      .catch((err) => {
        if (!cancelled) setBuyResult({ key: buyKey, line: null, error: err?.code || "unavailable" });
      });
    return () => { cancelled = true; };
    // searchParams is read once per item (buyKey); quantity changes do not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyKey]);

  useEffect(() => {
    if (!successOrder) writeDraft({ name, phone, confirmPhone, email, city, deliveryAddress });
  }, [name, phone, confirmPhone, email, city, deliveryAddress, successOrder]);

  const changeQuantity = (item, qty) => {
    if (buyNow) {
      setSearchParams((p) => { p.set("qty", String(qty)); return p; }, { replace: true });
    } else {
      updateQuantity(item, qty);
    }
    setMessage("");
  };

  // Make sure an error after submitting is visible.
  useEffect(() => {
    // Field errors focus the first invalid field instead; this is for server/network errors.
    const hasFieldErrors = Object.values(errors).some(Boolean);
    if (message && !hasFieldErrors) messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message, errors]);

  useEffect(() => {
    // Fire once when the checkout has its items (a "Purchase Now" item loads first), not on re-renders.
    if (checkoutTracked.current || lines.length === 0) return;
    checkoutTracked.current = true;
    fbTrack("InitiateCheckout", cartPayload(lines, totalPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  // The success view replaces the form: start it at the top.
  useEffect(() => {
    if (successOrder) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [successOrder]);

  const phoneMismatch = confirmPhone !== "" && normalizeMoroccanPhone(confirmPhone) !== normalizeMoroccanPhone(phone);

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (!phone.trim()) next.phone = t("phoneRequired");
    else if (!isValidMoroccanPhone(phone)) next.phone = t("phoneInvalid");
    if (!confirmPhone.trim() || normalizeMoroccanPhone(confirmPhone) !== normalizeMoroccanPhone(phone)) next.confirmPhone = t("phoneMismatchHint");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t("emailInvalid");
    const cityOk = !!findCity(city);
    setCityError(!cityOk);
    if (!cityOk) next.city = t("cityInvalid");
    if (deliveryAddress.trim().length < 5) next.deliveryAddress = t("deliveryAddressRequired");
    setErrors(next);
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || lines.length === 0) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setMessage(t("fixErrors"));
      const firstField = ["name", "phone", "confirmPhone", "email", "city", "deliveryAddress"].find((f) => found[f]);
      document.querySelector(`[data-field="${firstField}"]`)?.focus();
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setMessage("");

    const linesAtSubmit = lines.map((item) => ({ ...item }));
    const orderData = {
      client: {
        name: name.trim(),
        email: email.trim(),
        phone: normalizeMoroccanPhone(phone),
        city,
        delivery_address: deliveryAddress.trim(),
        address: deliveryAddress.trim(),
      },
      products: payload,
      // The total on screen: the server refuses the order (409) instead of recording another amount.
      expected_total: totalPrice,
      // Language selected on the site (en/fr/ar), used for the confirmation email.
      locale: i18n.resolvedLanguage || i18n.language,
    };

    try {
      const order = await api.createOrder(orderData);
      if (!order?.id) throw new Error("Order was not created");
      // Only reached after the server saved the order (HTTP 201).
      trackPurchase(order, linesAtSubmit);
      setSuccessOrder(order);
      if (buyNow) {
        // Only this item was bought: the rest of the cart stays, minus the same item.
        removeFromCart(linesAtSubmit[0]);
        // A refresh must not show the same order form again.
        setSearchParams({}, { replace: true });
      } else {
        clearCart();
      }
      clearDraft();
      setSubmitting(false);
    } catch (error) {
      submitLock.current = false;
      setSubmitting(false);
      const data = error?.data || {};
      if (error?.status === 409 && data.code === "total_changed" && data.quote) {
        // Prices changed meanwhile: show the server's amounts and let the customer confirm again.
        setQuote({ key: quoteKey, data: data.quote });
        setMessage(t("priceUpdated"));
      } else {
        setMessage(error?.status === 422 && data.message ? `${t("orderError")} ${data.message}` : t("orderError"));
      }
      console.error(error);
    }
  };

  // ───────────── Success page ─────────────
  if (successOrder) {
    // Amounts recorded by the server for this order.
    const discount = (successOrder.products || []).reduce((n, p) => n + (Number(p.offer_discount) || 0), 0);
    return (
      <main className="checkout-main">
        <section className="checkout-success" role="status" aria-live="polite" data-testid="checkout-success">
          <div className="success-checkmark">✓</div>
          <h2>{t("orderSuccess")}</h2>
          <p className="success-ref">{t("orderNumber")} <strong dir="ltr">#{successOrder.id}</strong></p>
          <p className="success-next">{t("orderSuccessCall")}</p>
          <table className="summary-table success-table">
            <tbody>
              {(successOrder.products || []).map((p, i) => (
                <tr key={i}>
                  <td>
                    <bdi>{p.name}</bdi>{p.variant_label ? <span className="st-variant"> · 🔌 {p.variant_label}</span> : null}
                    <span className="st-qty"> <bdi dir="ltr">× {p.quantity}</bdi></span>
                  </td>
                  <td className="st-amount"><Money value={p.line_subtotal ?? p.price * p.quantity} /></td>
                </tr>
              ))}
              {discount > 0 && (
                <tr className="st-discount">
                  <td>{t("discountLine")}</td>
                  <td className="st-amount"><Money value={discount} negative /></td>
                </tr>
              )}
              <tr>
                <td>{t("deliveryFeeLine")}</td>
                <td className="st-amount"><Money value={successOrder.delivery_fee} /></td>
              </tr>
              <tr className="st-total">
                <td>{t("totalToPayCaps")}</td>
                <td className="st-amount" data-testid="success-total"><Money value={successOrder.total_price} /></td>
              </tr>
            </tbody>
          </table>
          <p className="pay-note">💵 {t("payOnDelivery")}</p>
          <Link to="/" className="confirm-order-btn success-home-button">{t("backHome")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-main">
      <div className="checkout-header">
        <h2>{t("checkout")}</h2>
        {buyNow && (
          <Link to={buyNowItemPath(searchParams)} className="checkout-back-link">← {t("backToProduct")}</Link>
        )}
      </div>

      {buyLoading && (
        <div className="checkout-state" role="status">
          <div className="checkout-spinner"></div>
          <p>{t("checkoutLoading")}</p>
        </div>
      )}

      {buyError && (
        <div className="checkout-state" role="alert">
          <p>{t(buyError === "needsChoice" ? "buyNowNeedsChoice" : "buyNowUnavailable")}</p>
          <Link to={buyError === "unavailable" ? "/products" : buyNowItemPath(searchParams)} className="checkout-button checkout-state-btn">
            {buyError === "unavailable" ? t("startShopping") : t("backToProduct")}
          </Link>
        </div>
      )}

      {!buyNow && cart.length === 0 && (
        <div className="checkout-state">
          <p>{t("emptyCart")} 🛒</p>
          <Link to="/products" className="checkout-button checkout-state-btn">{t("startShopping")} →</Link>
        </div>
      )}

      {lines.length > 0 && (
        <form onSubmit={handleSubmit} className="checkout-flow" noValidate>
          {/* ── Step 1: customer details ── */}
          <section className="checkout-step">
            <h3 className="checkout-step-title"><span className="step-num">1</span> {t("shippingInfo")}</h3>
            <p className="required-note">{t("requiredNote")}</p>
            <div className="checkout-form">
              <input
                type="text"
                name="name"
                data-field="name"
                autoComplete="name"
                enterKeyHint="next"
                placeholder={`${t("fullName")} *`}
                aria-label={t("fullName")}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }}
                className={`checkout-input ${errors.name ? "input-error" : ""}`}
                aria-invalid={!!errors.name}
                required
              />
              {errors.name && <span className="error-hint">{errors.name}</span>}
              <input
                type="tel"
                name="tel"
                data-field="phone"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder={`${t("phoneWhatsapp")} * ⁦(06 12 34 56 78)⁩`}
                aria-label={t("phoneWhatsapp")}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErrors((x) => ({ ...x, phone: undefined })); }}
                onBlur={() => phone && !isValidMoroccanPhone(phone) && setErrors((x) => ({ ...x, phone: t("phoneInvalid") }))}
                className={`checkout-input ${errors.phone ? "input-error" : ""}`}
                aria-invalid={!!errors.phone}
                required
              />
              {errors.phone && <span className="error-hint">{errors.phone}</span>}
              <input
                type="tel"
                name="tel-confirm"
                data-field="confirmPhone"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder={`${t("confirmPhone")} *`}
                aria-label={t("confirmPhone")}
                value={confirmPhone}
                onChange={(e) => { setConfirmPhone(e.target.value); setErrors((x) => ({ ...x, confirmPhone: undefined })); }}
                className={`checkout-input ${phoneMismatch || errors.confirmPhone ? "input-error" : ""}`}
                aria-invalid={phoneMismatch || !!errors.confirmPhone}
                required
              />
              {(phoneMismatch || errors.confirmPhone) && (
                <span className="error-hint">{t("phoneMismatchHint")}</span>
              )}
              <div data-field="city" tabIndex={-1}>
                <CitySelect
                  value={city}
                  onChange={(c) => {
                    setCity(c);
                    if (c) { setCityError(false); setErrors((x) => ({ ...x, city: undefined })); }
                  }}
                  invalid={cityError}
                />
              </div>
              {cityError && <span className="error-hint">{t("cityInvalid")}</span>}

              <label htmlFor="checkout-delivery-address" className="checkout-field-label">
                {t("deliveryAddress")} *
              </label>
              <textarea
                id="checkout-delivery-address"
                name="street-address"
                data-field="deliveryAddress"
                autoComplete="street-address"
                rows={3}
                maxLength={500}
                dir="auto"
                placeholder={t("deliveryAddressPlaceholder")}
                value={deliveryAddress}
                onChange={(e) => { setDeliveryAddress(e.target.value); setErrors((x) => ({ ...x, deliveryAddress: undefined })); }}
                className={`checkout-input checkout-textarea ${errors.deliveryAddress ? "input-error" : ""}`}
                aria-invalid={!!errors.deliveryAddress}
                aria-describedby="checkout-delivery-address-help"
                required
              />
              {errors.deliveryAddress
                ? <span className="error-hint" id="checkout-delivery-address-help">{errors.deliveryAddress}</span>
                : <span className="field-help" id="checkout-delivery-address-help">{t("deliveryAddressHelp")}</span>}

              <input
                type="email"
                name="email"
                data-field="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                enterKeyHint="done"
                placeholder={t("emailOptional")}
                aria-label={t("emailOptional")}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: undefined })); }}
                className={`checkout-input ${errors.email ? "input-error" : ""}`}
                aria-invalid={!!errors.email}
              />
              {errors.email ? <span className="error-hint">{errors.email}</span> : <span className="field-help">{t("emailHelp")}</span>}
            </div>
          </section>

          {/* ── Step 2: order summary ── */}
          <section className="checkout-step order-summary" aria-labelledby="order-summary-title">
            <h3 className="checkout-step-title" id="order-summary-title"><span className="step-num">2</span> {t("orderSummary")}</h3>
            <p className="summary-count">{t("orderLinesCount", { count: amounts.items })}</p>

            <ul className="summary-items">
              {lines.map((item, index) => {
                const a = lineAmounts(item, index);
                const qty = Number(item.quantity) || 1;
                return (
                  <li key={cartLineKey(item)} className="summary-item" data-testid="summary-line">
                    <div className="summary-media">
                      <img src={cartLineImage(item)} alt={item.name} className="summary-image" />
                    </div>
                    <div className="summary-details">
                      <div className="summary-name-row">
                        <h4>{item.name}</h4>
                        {!buyNow && (
                          <button type="button" className="summary-remove" onClick={() => removeFromCart(item)} aria-label={`${t("remove")}: ${item.name}`} disabled={submitting}>
                            ✕
                          </button>
                        )}
                      </div>
                      <CartLineExtras item={item} />
                      {isBogoDeal(item) && <span className="summary-offer-tag">{offerLabel(item, t)}</span>}
                      <div className="summary-line-controls">
                        <div data-testid="line-qty" data-qty={qty}>
                          <QuantitySelector
                            size="sm"
                            showLabel={false}
                            value={qty}
                            disabled={submitting}
                            onChange={(q) => changeQuantity(item, q)}
                          />
                        </div>
                        <div className="summary-line-amounts">
                          <span className="lf-unit"><Money value={a.unit} /> <span className="lf-per">{t("perItem")}</span></span>
                          {a.discount > 0 && <s className="lf-was"><Money value={a.subtotal} /></s>}
                          <strong data-testid="line-subtotal"><Money value={a.total} /></strong>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <table className="summary-table" data-testid="price-breakdown">
              <thead className="sr-only">
                <tr><th>{t("summaryDescription")}</th><th>{t("summaryAmount")}</th></tr>
              </thead>
              <tbody>
                {lines.map((item, index) => (
                  <tr key={cartLineKey(item)}>
                    <td><bdi>{item.name}</bdi> <span className="st-qty"><bdi dir="ltr">× {item.quantity}</bdi></span></td>
                    <td className="st-amount"><Money value={lineAmounts(item, index).subtotal} /></td>
                  </tr>
                ))}
                <tr className="st-sub">
                  <td>{t("productsSubtotal")}</td>
                  <td className="st-amount" data-testid="products-subtotal"><Money value={amounts.gross} /></td>
                </tr>
                <tr className="st-discount">
                  <td>{t("discountLine")}</td>
                  <td className="st-amount" data-testid="discount"><Money value={amounts.discount} negative /></td>
                </tr>
                <tr>
                  <td>🚚 {t("deliveryFeeLine")}</td>
                  <td className="st-amount" data-testid="delivery-fee"><Money value={amounts.delivery} /></td>
                </tr>
                <tr className="st-total">
                  <td>{t("totalToPayCaps")}</td>
                  <td className="st-amount" data-testid="you-pay"><Money value={amounts.total} /></td>
                </tr>
              </tbody>
            </table>
            <p className="pay-note">💵 {t("payOnDelivery")}</p>
            {quoteProblem && (
              <p className="checkout-message" role="alert">
                {quoteProblem.message || t("orderError")}
              </p>
            )}
          </section>

          {/* ── Final action ── */}
          <button
            type="submit"
            className={`confirm-order-btn${submitting ? " is-loading" : ""}`}
            disabled={submitting || !!quoteProblem}
            aria-busy={submitting}
            data-testid="confirm-order"
          >
            {submitting ? (
              <>
                <span className="btn-spinner" aria-hidden="true"></span>
                <span>{t("processingOrder")}</span>
              </>
            ) : (
              <>
                <span className="confirm-label">{t("confirmOrder")}</span>
                <span className="confirm-sub">{t("totalToPayCaps")}: <Money value={amounts.total} /></span>
              </>
            )}
          </button>
          {message && <p ref={messageRef} className="checkout-message" role="alert">{message}</p>}
        </form>
      )}
    </main>
  );
}
