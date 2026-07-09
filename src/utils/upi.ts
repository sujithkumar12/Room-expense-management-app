/**
 * Build a UPI deep link for PhonePe, GPay, Paytm, etc.
 */
export function buildUpiPaymentLink(options: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: options.upiId.trim(),
    pn: options.payeeName.trim().slice(0, 50),
    am: options.amount.toFixed(2),
    cu: 'INR',
    tn: (options.note || 'RoomSplit payment').slice(0, 100),
  });
  return `upi://pay?${params.toString()}`;
}

export function suggestedPayAmount(myBalance: number, theirBalance: number): number | null {
  if (myBalance >= 0 || theirBalance <= 0) return null;
  const amount = Math.min(Math.abs(myBalance), theirBalance);
  return amount > 0 ? Math.round(amount * 100) / 100 : null;
}
