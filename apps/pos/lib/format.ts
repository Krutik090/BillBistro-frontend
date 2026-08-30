/** paise -> "₹1,240.50" (drops .00) */
export const inr = (paise: number) => {
  const neg = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const r = Math.floor(abs / 100), p = abs % 100;
  return `${neg}₹${r.toLocaleString("en-IN")}${p ? "." + String(p).padStart(2, "0") : ""}`;
};
export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
