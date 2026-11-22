// − [ 5 ] + quantity picker: buttons and free typing, any whole number from 1 up (no maximum).
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { clampQuantity, parseQuantity } from "../utils/quantity";
import "./QuantitySelector.css";

export default function QuantitySelector({ value, onChange, disabled = false, size = "md", showLabel = true, className = "" }) {
  const { t } = useTranslation();
  const id = useId();
  // What is in the box while typing (it may be empty for a moment).
  const [draft, setDraft] = useState(String(value));

  // Follow quantity changes made elsewhere (cart sync, stock clamp).
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }

  const commit = (next) => {
    const qty = clampQuantity(next);
    setDraft(String(qty));
    if (qty !== value) onChange(qty);
  };

  const onType = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, "");
    setDraft(digits);
    const n = parseQuantity(digits);
    if (n !== null) commit(n);
  };

  return (
    <div className={`qty-selector qty-${size}${disabled ? " is-disabled" : ""} ${className}`.trim()}>
      {showLabel && <label htmlFor={id} className="qty-label">{t("quantityLabel")}</label>}
      <div className="qty-control" dir="ltr">
        <button
          type="button"
          className="qty-btn"
          onClick={() => commit(value - 1)}
          disabled={disabled || value <= 1}
          aria-label={t("decreaseQty")}
        >
          −
        </button>
        <input
          id={id}
          className="qty-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          onChange={onType}
          onFocus={(e) => e.target.select()}
          // Empty or invalid box on leaving: back to the last valid quantity.
          onBlur={() => setDraft(String(value))}
          aria-label={t("quantityLabel")}
        />
        <button
          type="button"
          className="qty-btn"
          onClick={() => commit(value + 1)}
          disabled={disabled}
          aria-label={t("increaseQty")}
        >
          +
        </button>
      </div>
    </div>
  );
}
