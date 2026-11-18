// src/Components/CitySelect.jsx
// Searchable Moroccan city combobox used in checkout.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { findCity, searchCities } from "../utils/moroccanCities";

export default function CitySelect({ value, onChange, invalid, className = "" }) {
  const { t, i18n } = useTranslation();
  const listId = useId();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const results = useMemo(() => searchCities(query), [query]);
  const isArabic = i18n.language?.startsWith("ar");

  // Keep the visible text in sync if the parent resets the value
  // (adjusting state during render instead of in an effect).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value) setQuery(value);
  }

  // Scroll the highlighted option into view during keyboard navigation.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // The checkout layout clips overflow, so open upward when there's no room below.
  const updateDirection = () => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const container = input.closest(".checkout-content");
    const bottomLimit = Math.min(
      window.innerHeight,
      container ? container.getBoundingClientRect().bottom : window.innerHeight
    );
    setDropUp(bottomLimit - rect.bottom < 240 && rect.top > 260);
  };

  const openList = () => {
    updateDirection();
    setOpen(true);
  };

  const select = (city) => {
    setQuery(city.name);
    onChange(city.name);
    setOpen(false);
  };

  const handleInput = (e) => {
    const text = e.target.value;
    setQuery(text);
    setActive(0);
    // Typing invalidates a previous selection until a city is picked again.
    const exact = findCity(text);
    onChange(exact ? exact.name : "");
    openList();
  };

  const handleBlur = () => {
    // Accept an exact typed match (e.g. "fes" -> "Fès") without clicking.
    const exact = findCity(query);
    if (exact) {
      setQuery(exact.name);
      onChange(exact.name);
    }
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        select(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`city-select ${className}`} ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={t("cityPlaceholder")}
        value={query}
        onChange={handleInput}
        onFocus={openList}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`checkout-input city-select-input ${invalid ? "input-error" : ""}`}
      />
      {value && <span className="city-select-check" aria-hidden="true">✓</span>}

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className={`city-select-list ${dropUp ? "drop-up" : ""}`}
        >
          {results.length === 0 ? (
            <li className="city-select-empty">{t("cityNoMatch")}</li>
          ) : (
            results.map((city, i) => (
              <li
                key={city.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`city-select-option ${i === active ? "active" : ""} ${
                  city.name === value ? "selected" : ""
                }`}
                // mousedown fires before the input blurs, so the click isn't lost
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(city);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="city-select-name">{isArabic ? city.ar : city.name}</span>
                <span className="city-select-alt">{isArabic ? city.name : city.ar}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
