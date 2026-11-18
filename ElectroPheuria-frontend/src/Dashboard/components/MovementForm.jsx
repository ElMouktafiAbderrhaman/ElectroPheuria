// Add / edit one ledger movement. The fields adapt to what is being recorded; the server
// validates, computes stock totals and updates every balance and report from the saved row.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MOROCCAN_CITIES } from "../../utils/moroccanCities";
import { fmt } from "../../utils/financeCalc";

// Each choice = movement type (+ spending category).
// eslint-disable-next-line react-refresh/only-export-components
export const KINDS = [
  { key: "income", type: "income" },
  { key: "packaging", type: "expense", category: "packaging" },
  { key: "tiktok_ads", type: "expense", category: "tiktok_ads" },
  { key: "meta_ads", type: "expense", category: "meta_ads" },
  { key: "stock", type: "expense", category: "stock" },
  { key: "delivery", type: "expense", category: "delivery" },
  { key: "other", type: "expense", category: "other" },
  { key: "withdrawal", type: "withdrawal" },
  { key: "deposit", type: "deposit" },
];

// eslint-disable-next-line react-refresh/only-export-components
export const kindOf = (m) => (m.type === "expense" ? m.category || "other" : m.type);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const blank = (kind = "packaging") => ({
  kind, occurred_on: today(), amount: "", account: kind === "income" ? "cash" : "bank", label: "", notes: "",
  source: "", order_id: "", item: "", quantity: "", unit_cost: "", add_to_stock: false, city: "", carrier: "", order_ref: "",
});

const fromMovement = (m) => ({
  kind: kindOf(m), occurred_on: m.occurred_on, amount: m.amount ?? "", account: m.account || "bank",
  label: m.type === "income" ? "" : m.label || "", notes: m.notes || "", source: m.source || "", order_id: m.order_id ? String(m.order_id) : "",
  item: m.item_type && m.item_id ? `${m.item_type}-${m.item_id}` : "", quantity: m.quantity ?? "", unit_cost: m.unit_cost ?? "",
  add_to_stock: (m.stock_added || 0) > 0, city: m.city || "", carrier: m.carrier || "", order_ref: m.order_ref || "",
});

/** Request body for POST / PUT /api/finance/movements. */
function payload(f) {
  const kind = KINDS.find((k) => k.key === f.kind);
  const body = { type: kind.type, occurred_on: f.occurred_on, notes: f.notes.trim() || null };
  if (kind.type === "withdrawal" || kind.type === "deposit") return { ...body, amount: Number(f.amount) };
  if (kind.type === "income") {
    return { ...body, amount: Number(f.amount), account: f.account, source: f.source.trim() || null, order_id: f.order_id ? Number(f.order_id) : null };
  }
  const out = { ...body, category: kind.category, account: f.account, label: f.label.trim() || null };
  if (kind.category === "stock") {
    const [item_type, item_id] = f.item.split("-");
    return { ...out, item_type, item_id: Number(item_id), quantity: Number(f.quantity), unit_cost: Number(f.unit_cost), add_to_stock: f.add_to_stock };
  }
  if (kind.category === "delivery") {
    return { ...out, amount: Number(f.amount), city: f.city.trim(), carrier: f.carrier.trim() || null, order_ref: f.order_ref.trim() || null };
  }
  return { ...out, amount: Number(f.amount) };
}

export default function MovementForm({ data, editing, onSubmit, onCancel }) {
  const { t, i18n } = useTranslation();
  const [f, setF] = useState(() => (editing ? fromMovement(editing) : blank()));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const kind = KINDS.find((k) => k.key === f.kind);
  const isTransfer = kind.type === "withdrawal" || kind.type === "deposit";
  const isStock = kind.category === "stock";
  const isDelivery = kind.category === "delivery";
  const balances = data.summary.balances;

  // Last delivery cost recorded per city, to pre-fill the cost when a city is picked again.
  const lastCostByCity = useMemo(() => {
    const map = {};
    [...data.movements].filter((m) => m.category === "delivery" && m.city)
      .sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1))
      .forEach((m) => { map[m.city.toLowerCase()] = m.amount; });
    return map;
  }, [data.movements]);
  const lastCost = f.city ? lastCostByCity[f.city.trim().toLowerCase()] : undefined;

  // Orders an income can be linked to: shipped / delivered and not already received (or this one's).
  const received = new Set(data.orders.received_order_ids);
  const linkable = data.orders.linkable.filter((o) => !received.has(o.id) || String(o.id) === String(editing?.order_id ?? ""));
  const item = data.items.find((it) => `${it.type}-${it.id}` === f.item);
  const stockTotal = Number(f.quantity) > 0 && f.unit_cost !== "" ? Math.round(Number(f.quantity) * Number(f.unit_cost) * 100) / 100 : null;
  const source = kind.type === "withdrawal" ? "bank" : "cash";

  const submit = (e) => {
    e.preventDefault();
    onSubmit(payload(f), () => setF(blank(f.kind)));
  };

  const fld = (id, label, input, sub) => (
    <div className="fld"><label htmlFor={id}>{label}</label>{input}{sub && <div className="sub">{sub}</div>}</div>
  );
  const accountSelect = (label) => fld("mv-acc", label,
    <select id="mv-acc" value={f.account} onChange={(e) => set({ account: e.target.value })}>
      <option value="cash">{t("fin_cash")}</option><option value="bank">{t("fin_bank")}</option>
    </select>);
  const amountInput = (label = t("fin_amount")) => fld("mv-amt", label,
    <input id="mv-amt" type="number" step="0.01" min="0.01" required value={f.amount} onChange={(e) => set({ amount: e.target.value })} />);
  const dateInput = fld("mv-date", t("fin_date"),
    <input id="mv-date" type="date" required value={f.occurred_on} onChange={(e) => set({ occurred_on: e.target.value })} />);

  return (
    <form className="mvx" onSubmit={submit} dir={i18n.dir()}>
      <div className="capt">{editing ? t("fin_editMovement") : t("fin_addMovement")}</div>
      <div className="picker mvkinds" role="radiogroup">
        {KINDS.map((k) => (
          <button key={k.key} type="button" role="radio" aria-checked={f.kind === k.key} className={`pick ${f.kind === k.key ? "on" : ""} k-${k.type}`}
            onClick={() => set({ kind: k.key, account: k.key === "income" ? f.account : f.account || "bank" })}>{t(`fin_kind_${k.key}`)}</button>
        ))}
      </div>

      <div className="fgrid mvgrid">
        {kind.type === "income" && (<>
          {amountInput()}
          {fld("mv-src", t("fin_source"), <input id="mv-src" type="text" maxLength={255} placeholder={t("fin_sourcePh")} value={f.source} onChange={(e) => set({ source: e.target.value })} />)}
          {dateInput}
          {accountSelect(t("fin_accountIn"))}
          {fld("mv-ord", t("fin_order"),
            <select id="mv-ord" value={f.order_id} onChange={(e) => {
              const o = data.orders.linkable.find((x) => String(x.id) === e.target.value);
              set({ order_id: e.target.value, ...(o && !f.amount ? { amount: String(o.total) } : {}) });
            }}>
              <option value="">{t("fin_noOrder")}</option>
              {linkable.map((o) => <option key={o.id} value={o.id}>#{o.id} · {fmt(o.total)} · {o.customer || ""} {o.city ? `(${o.city})` : ""} · {o.status}</option>)}
            </select>)}
        </>)}

        {isStock && (<>
          {fld("mv-item", t("fin_product"),
            <select id="mv-item" required value={f.item} onChange={(e) => set({ item: e.target.value })}>
              <option value="">{t("fin_chooseProduct")}</option>
              {data.items.map((it) => <option key={`${it.type}-${it.id}`} value={`${it.type}-${it.id}`}>{it.name} ({it.type === "deal" ? (it.bundle ? "pack" : "deal") : "product"})</option>)}
            </select>)}
          {fld("mv-qty", t("fin_quantity"), <input id="mv-qty" type="number" min="1" step="1" required value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} />)}
          {fld("mv-unit", t("fin_unitCost"), <input id="mv-unit" type="number" min="0" step="0.01" required value={f.unit_cost} onChange={(e) => set({ unit_cost: e.target.value })} />)}
          {fld("mv-tot", t("fin_total"), <div className="readonly num" id="mv-tot">{stockTotal === null ? "—" : fmt(stockTotal)}</div>)}
        </>)}

        {isDelivery && (<>
          {fld("mv-city", t("fin_city"), <>
            <input id="mv-city" type="text" list="mv-cities" required maxLength={100} value={f.city}
              onChange={(e) => {
                const city = e.target.value;
                const last = lastCostByCity[city.trim().toLowerCase()];
                set({ city, ...(last !== undefined && f.amount === "" ? { amount: String(last) } : {}) });
              }} />
            <datalist id="mv-cities">{MOROCCAN_CITIES.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </>, lastCost !== undefined ? t("fin_lastCost", { city: f.city, amount: lastCost }) : null)}
          {amountInput(t("fin_deliveryCost"))}
          {fld("mv-carrier", t("fin_carrier"), <input id="mv-carrier" type="text" maxLength={100} value={f.carrier} onChange={(e) => set({ carrier: e.target.value })} />)}
          {fld("mv-ref", t("fin_orderRef"), <input id="mv-ref" type="text" maxLength={50} value={f.order_ref} onChange={(e) => set({ order_ref: e.target.value })} />)}
        </>)}

        {kind.type === "expense" && !isStock && !isDelivery && (<>
          {fld("mv-desc", t("fin_description"), <input id="mv-desc" type="text" maxLength={255} value={f.label} onChange={(e) => set({ label: e.target.value })} />)}
          {amountInput()}
        </>)}

        {isTransfer && amountInput()}

        {kind.type === "expense" && (<>{dateInput}{accountSelect(t("fin_account"))}</>)}
        {isTransfer && dateInput}
        {kind.type !== "income" && fld("mv-notes", t("fin_notes"), <input id="mv-notes" type="text" maxLength={2000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />)}
      </div>

      {isStock && item && (
        <label className="chk mvchk"><input type="checkbox" checked={f.add_to_stock} onChange={(e) => set({ add_to_stock: e.target.checked })} />
          <span>{t("fin_addToStock", { stock: item.stock })}</span></label>
      )}

      <p className="sub mvhint">
        {isTransfer
          ? <>{t("fin_transferNote")} {t("fin_available", { account: t(`fin_${source}`), amount: balances[source] })}</>
          : kind.type === "income"
            ? t("fin_incomeAuto", { account: t(`fin_${f.account}`) })
            : t("fin_spendingAuto", { category: t(`fin_kind_${kind.key}`) })}
      </p>
      <div className="acts">
        {editing && <button type="button" className="g" onClick={onCancel}>{t("fin_cancel")}</button>}
        <button type="submit">{editing ? t("fin_save") : t("fin_add")}</button>
      </div>
    </form>
  );
}
