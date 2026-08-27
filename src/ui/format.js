export function formatAmount(value, currency) {
  return `${Number(value).toFixed(2)} ${currency}`;
}

export function formatPanelAmount(value, currency) {
  return `${currency} ${Number(value).toFixed(2)}`;
}

export function hasAtMostTwoDecimalPlaces(value) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}
