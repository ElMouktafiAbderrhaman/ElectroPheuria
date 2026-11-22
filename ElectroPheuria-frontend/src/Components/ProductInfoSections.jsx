// Everything below the purchase area of a product / deal page, as collapsible sections:
// description, specifications, what's in the box, compatibility, warranty & returns,
// delivery & payment, more info and FAQ. Sections without content are not shown.
//
// "What's in the box", "Compatibility" and "Warranty" come from the item's specification
// rows: a row labelled e.g. "In the box" / "Contenu de la boîte" / "Compatibility" /
// "Garantie" is shown in that section instead of the general specifications table.
import { useTranslation } from "react-i18next";
import DeliveryInfo from "./DeliveryInfo";
import "./ProductInfoSections.css";

const BOX = /in the box|box content|included|inclus|contenu|dans la bo[iî]te|العلبة|محتوى/i;
const COMPAT = /compat|متوافق|التوافق/i;
const WARRANTY = /warrant|guarantee|garantie|authentic|authenti|original|ضمان|أصلي/i;

const textOf = (value, lang) => {
  if (!value) return "";
  if (typeof value === "object") return value[lang] || value.fr || value.en || "";
  return String(value);
};

function SpecRows({ rows }) {
  return (
    <table className="specs-table">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td className="spec-label">{row.label}</td>
            <td className="spec-value">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, open = false, children, id }) {
  return (
    <details className="info-section" open={open} id={id}>
      <summary>
        <span>{title}</span>
        <span className="info-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="info-body">{children}</div>
    </details>
  );
}

export default function ProductInfoSections({ item, noReviewsKey = "noReviews" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const rows = (Array.isArray(item?.specs) ? item.specs : [])
    .map((r) => ({ label: textOf(r?.label, lang).trim(), value: textOf(r?.value, lang).trim() }))
    .filter((r) => r.label);
  const box = rows.filter((r) => BOX.test(r.label));
  const compat = rows.filter((r) => !BOX.test(r.label) && COMPAT.test(r.label));
  const warranty = rows.filter((r) => !BOX.test(r.label) && !COMPAT.test(r.label) && WARRANTY.test(r.label));
  const specs = rows.filter((r) => !box.includes(r) && !compat.includes(r) && !warranty.includes(r));

  const description = textOf(item?.description, lang);
  const moreInfo = textOf(item?.reviews, lang);

  return (
    <section className="product-info-sections" aria-label={t("productDetailsTitle")}>
      <h2 className="info-sections-title">{t("productDetailsTitle")}</h2>

      {description && (
        <Section title={t("description")} open>
          <p className="info-text">{description}</p>
        </Section>
      )}

      {specs.length > 0 && (
        <Section title={t("productSpecs")} open>
          <SpecRows rows={specs} />
        </Section>
      )}

      {box.length > 0 && (
        <Section title={t("secInBox")}>
          {box.map((r, i) => <p key={i} className="info-text">{r.value || r.label}</p>)}
        </Section>
      )}

      {compat.length > 0 && (
        <Section title={t("secCompat")}>
          {compat.map((r, i) => <p key={i} className="info-text">{r.value || r.label}</p>)}
        </Section>
      )}

      {moreInfo && moreInfo !== t(noReviewsKey) && (
        <Section title={t("reviews")}>
          <p className="info-text">{moreInfo}</p>
        </Section>
      )}

      <Section title={t("secWarranty")}>
        {warranty.length > 0 && <SpecRows rows={warranty} />}
        <p className="info-text">{t("returnsP1")}</p>
        <p className="info-text">{t("returnsP2")}</p>
      </Section>

      <Section title={t("secDelivery")}>
        <DeliveryInfo />
      </Section>

      <Section title={t("faqTitle")}>
        {[2, 3, 4, 5].map((n) => (
          <div key={n} className="info-faq">
            <p className="info-faq-q">{t(`faq${n}Q`)}</p>
            <p className="info-text">{t(`faq${n}A`)}</p>
          </div>
        ))}
      </Section>
    </section>
  );
}
