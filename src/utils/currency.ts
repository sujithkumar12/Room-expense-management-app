export function formatCurrency(amount: number) {
  const hasFraction = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUpiAmount(amount: number) {
  return amount.toFixed(2);
}
