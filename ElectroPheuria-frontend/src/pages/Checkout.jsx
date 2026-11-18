// src/pages/Checkout.jsx
import { useState, useEffect, useRef } from "react";
import { useCart, cartLineKey } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { fbTrack, cartPayload, trackPurchase } from "../utils/fbPixel";
import { findCity } from "../utils/moroccanCities";
import { orderTotals, lineTotal, isBogoDeal, offerLabel, formatPrice } from "../utils/dealPricing";
import CitySelect from "../Components/CitySelect";
import CartLineExtras, { cartLineImage } from "../Components/CartLineExtras";
import { normalizeMoroccanPhone, isValidMoroccanPhone } from "../utils/phone";
import "./Checkout.css";

/** "318 DH": the number stays left-to-right inside Arabic text, the currency follows the language. */
function Money({ value, negative = false }) {
  const { t } = useTranslation();
  return (
    <span className="money">
      <bdi dir="ltr">{negative ? "−" : ""}{formatPrice(value)}</bdi> {t("currency")}
    </span>
  );
}

/** Products subtotal + delivery fee = amount to pay. Shown in the summary and next to the order button. */
function PriceBreakdown({ totals, compact = false }) {
  const { t } = useTranslation();
  const { products, delivery, total, items } = totals;
  return (
    <div className={`price-breakdown${compact ? " price-breakdown-compact" : ""}`} data-testid={compact ? "pay-recap" : "price-breakdown"}>
      <div className="pb-row">
        <span>
          {t("productsSubtotal")}
          {items > 0 && <span className="pb-row-sub"> · {t("itemCount", { count: items })}</span>}
        </span>
        <strong data-testid="products-subtotal"><Money value={products} /></strong>
      </div>
      <div className="pb-row pb-row-delivery">
        <span>🚚 {t("deliveryFeeLine")}</span>
        <strong data-testid="delivery-fee">+ <Money value={delivery} /></strong>
      </div>
      <div className="pb-row pb-row-total">
        <span>{t("youPay")}</span>
        <strong data-testid="you-pay"><Money value={total} /></strong>
      </div>
      <p className="pb-note">
        {t("youPayNote", { products: `${formatPrice(products)} ${t("currency")}`, delivery: `${formatPrice(delivery)} ${t("currency")}` })}
      </p>
    </div>
  );
}

export default function Checkout() {
  const { cart, clearCart, syncWithCatalog } = useCart();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [cityError, setCityError] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [message, setMessage] = useState("");
  // Synchronous lock: React state updates too late to stop a quick double tap.
  const submitLock = useRef(false);
  const checkoutTracked = useRef(false);
  const messageRef = useRef(null);

  // Display totals (incl. 1+1 offers and the fixed delivery fee). The server
  // recomputes the real amounts from database prices and adds the fee itself.
  const totals = orderTotals(cart);
  const totalPrice = totals.total;

  useEffect(() => {
    syncWithCatalog();
  }, [syncWithCatalog]);

  // Make sure an error after submitting is visible (it sits below the button on phones).
  useEffect(() => {
    // Field errors focus the first invalid field instead; this is for server/network errors.
    const hasFieldErrors = Object.values(errors).some(Boolean);
    if (message && !hasFieldErrors) messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message, errors]);

  useEffect(() => {
    // Fire once when the checkout page opens with items, not on re-renders.
    if (checkoutTracked.current || cart.length === 0) return;
    checkoutTracked.current = true;
    fbTrack("InitiateCheckout", cartPayload(cart, totalPrice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (submitLock.current) return;

    if (cart.length === 0) {
      navigate("/products");
      return;
    }

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

    const linesAtSubmit = cart.map((item) => ({ ...item }));
    const cleanPhone = normalizeMoroccanPhone(phone);
    const orderData = {
      client: {
        name: name.trim(),
        email: email.trim(),
        phone: cleanPhone,
        city,
        delivery_address: deliveryAddress.trim(),
        address: deliveryAddress.trim(),
      },
      products: cart.map(({ id, name, price, quantity, isDeal, oldPrice, old_price, variant_id, bundle_variants }) => ({
        id,
        name,
        price,
        quantity,
        ...(variant_id ? { variant_id } : {}),
        ...(bundle_variants && Object.keys(bundle_variants).length ? { bundle_variants } : {}),
        ...(isDeal ? { isDeal: true } : {}),
        ...(oldPrice !== undefined ? { oldPrice } : {}),
        ...(old_price !== undefined ? { old_price } : {}),
      })),
      // Informational only: the server ignores it and computes subtotal + delivery itself.
      total_price: totalPrice,
      // Language selected on the site (en/fr/ar), used for the confirmation email.
      locale: i18n.resolvedLanguage || i18n.language,
    };

    try {
      const order = await api.createOrder(orderData);
      if (!order?.id) throw new Error("Order was not created");
      // Only reached after the server saved the order (HTTP 201).
      trackPurchase(order, linesAtSubmit);
      clearCart();
      setSubmitting(false);
      setSuccessOrder(order);
      setTimeout(() => navigate("/"), 8000);
    } catch (error) {
      submitLock.current = false;
      setSubmitting(false);
      setMessage(error?.status === 422 && error?.data?.message ? `${t("orderError")} ${error.data.message}` : t("orderError"));
      console.error(error);
    }
  };

  return (
    <main className="checkout-main">
      {/* Loading Overlay */}
      {submitting && (
        <div className="checkout-overlay">
          <div className="checkout-overlay-content">
            <div className="checkout-spinner"></div>
            <p>{t("processingOrder")}</p>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {successOrder && (
        <div className="checkout-overlay success-overlay" role="dialog" aria-live="polite">
          <div className="checkout-overlay-content">
            <div className="success-checkmark">✓</div>
            <h3>{t("orderSuccess")}</h3>
            <p className="success-ref">{t("orderNumber")} <strong dir="ltr">#{successOrder.id}</strong></p>
            <p>{t("orderSuccessCall")}</p>
            {Number(successOrder.delivery_fee) > 0 && (
              <p className="success-breakdown">
                {t("productsSubtotal")}: <Money value={successOrder.subtotal} /> · {t("deliveryFee")}: <Money value={successOrder.delivery_fee} />
              </p>
            )}
            <p className="success-total">{t("totalToPay")}: <strong data-testid="success-total"><Money value={successOrder.total_price} /></strong></p>
            <button type="button" className="checkout-button success-home-button" onClick={() => navigate("/")}>
              {t("backHome")}
            </button>
          </div>
        </div>
      )}

      <div className="checkout-header">
        <h2>{t("checkout")}</h2>
      </div>
      
      <div className="checkout-content">
        {/* Left: User Info Form */}
        <div className="checkout-form-section">
          <h3>{t("shippingInfo")}</h3>
          <form onSubmit={handleSubmit} className="checkout-form" noValidate>
            <p className="required-note">{t("requiredNote")}</p>
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
            <input
              type="email"
              name="email"
              data-field="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              enterKeyHint="next"
              placeholder={t("emailOptional")}
              aria-label={t("emailOptional")}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: undefined })); }}
              className={`checkout-input ${errors.email ? "input-error" : ""}`}
              aria-invalid={!!errors.email}
            />
            {errors.email ? <span className="error-hint">{errors.email}</span> : <span className="field-help">{t("emailHelp")}</span>}
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

            {cart.length > 0 && (
              <div className="pay-recap">
                <p className="pay-recap-check">⚠️ {t("checkBeforeConfirm")}</p>
                <ul className="pay-recap-lines">
                  {cart.map((item) => (
                    <li key={cartLineKey(item)}>
                      <span className="pay-recap-qty"><bdi dir="ltr">{item.quantity} ×</bdi></span>
                      <span className="pay-recap-name">{item.name}</span>
                      <strong><Money value={lineTotal(item).total} /></strong>
                    </li>
                  ))}
                </ul>
                <PriceBreakdown totals={totals} compact />
                <p className="pay-recap-note">💵 {t("payOnDelivery")}</p>
              </div>
            )}

            <button type="submit" className="checkout-button" disabled={submitting || cart.length === 0}>
              {submitting ? t("processingOrder") : <>{t("submitOrder")} · <Money value={totalPrice} /></>}
            </button>
          </form>
          {message && <p ref={messageRef} className="checkout-message" role="alert">{message}</p>}
        </div>

        {/* Right: Order Summary & Delivery */}
        <div className="checkout-summary-section">
          {/* Order Summary */}
          <div className="order-summary">
            <h3>{t("orderSummary")}</h3>
            {cart.length > 0 && <p className="summary-count">{t("orderLinesCount", { count: totals.items })}</p>}
            <div className="summary-items">
              {cart.map((item) => {
                const line = lineTotal(item);
                const qty = Number(item.quantity) || 1;
                return (
                  <div key={cartLineKey(item)} className="summary-item" data-testid="summary-line">
                    <div className="summary-media">
                      <img src={cartLineImage(item)} alt={item.name} className="summary-image" />
                      <span className="summary-qty-badge" aria-hidden="true"><bdi dir="ltr">×{qty}</bdi></span>
                    </div>
                    <div className="summary-details">
                      <h4><span className="summary-qty-x"><bdi dir="ltr">{qty} ×</bdi></span> {item.name}</h4>
                      <CartLineExtras item={item} />
                      {isBogoDeal(item) && <span className="summary-offer-tag">{offerLabel(item, t)}</span>}
                      <dl className="line-figures">
                        <div className="lf-row lf-qty">
                          <dt>{t("quantityLabel")}</dt>
                          <dd data-testid="line-qty">{t("itemCount", { count: qty })}</dd>
                        </div>
                        <div className="lf-row">
                          <dt>{t("unitPrice")}</dt>
                          <dd><Money value={item.price} /> <span className="lf-per">{t("perItem")}</span></dd>
                        </div>
                        {line.discount > 0 && (
                          <div className="lf-row lf-saving">
                            <dt>{t("offerSavings")}</dt>
                            <dd><Money value={line.discount} negative /></dd>
                          </div>
                        )}
                        <div className="lf-row lf-subtotal">
                          <dt>{t("lineSubtotal")}</dt>
                          <dd>
                            <span className="lf-formula">
                              <bdi dir="ltr">{qty} × {formatPrice(item.price)}{line.discount > 0 ? ` − ${formatPrice(line.discount)}` : ""} =</bdi>
                            </span>{" "}
                            <strong data-testid="line-subtotal"><Money value={line.total} /></strong>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                );
              })}
            </div>
            {cart.length > 0 && <PriceBreakdown totals={totals} />}
          </div>

          {/* Delivery Info */}
          <div className="delivery-info">
            <h4>{t("delivery")}</h4>
            <p dangerouslySetInnerHTML={{ __html: t("deliveryTime") }} />
            <p>{t("deliveryNationwideFee")}</p>
            <p>💵 {t("payOnDelivery")}</p>
          </div>
        </div>
      </div>
    </main>
  );
}