// Delivery promise shown on product and deal pages, right under the purchase button.
import { useTranslation } from "react-i18next";
import "./BuyBox.css";

export default function DeliveryInfo() {
  const { t } = useTranslation();
  return (
    <ul className="delivery-promise">
      <li><span aria-hidden="true">🚚</span><span dangerouslySetInnerHTML={{ __html: t("deliveryTime") }} /></li>
      <li><span aria-hidden="true">📍</span><span>{t("deliveryNationwideFee")}</span></li>
      <li><span aria-hidden="true">💵</span><span>{t("payOnDelivery")}</span></li>
    </ul>
  );
}
