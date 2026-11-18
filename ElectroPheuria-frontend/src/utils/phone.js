// Moroccan phone helpers used by the checkout.

/** Digits only, with Moroccan international prefixes reduced to the local 0X form. */
export function normalizeMoroccanPhone(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+212")) d = "0" + d.slice(4);
  else if (d.startsWith("00212")) d = "0" + d.slice(5);
  else if (d.startsWith("212") && d.length === 12) d = "0" + d.slice(3);
  else if (/^[5-7]\d{8}$/.test(d)) d = "0" + d;
  d = d.replace(/\D/g, "");
  // "+212 06…" keeps the local 0 after the country code.
  return d.replace(/^00(?=[5-7]\d{8}$)/, "0");
}
/** Moroccan mobile/landline: 05, 06 or 07 followed by 8 digits. */
export const isValidMoroccanPhone = (raw) => /^0[5-7]\d{8}$/.test(normalizeMoroccanPhone(raw));
