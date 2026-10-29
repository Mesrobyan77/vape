/**
 * AMD formatting shared by UI, emails and server code.
 * Output: "12 500 ֏" — whole dram, groups of three separated by a regular space,
 * no decimals, symbol after the amount. Implemented without Intl so the output is
 * identical on every runtime and browser locale.
 */
export function formatAmd(amount: number): string {
  if (!Number.isFinite(amount)) throw new TypeError("amount must be finite");
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped} ֏`;
}
