import { formatUpiAmount } from './currency';

export type UpiPaymentLinks = {
  upi: string;
  gpay: string;
  phonepe: string;
  paytm: string;
};

function buildUpiQuery(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildUpiPaymentLinks(options: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}): UpiPaymentLinks {
  const query = buildUpiQuery({
    pa: options.upiId.trim(),
    pn: options.payeeName.trim().slice(0, 50),
    am: formatUpiAmount(options.amount),
    cu: 'INR',
    tn: (options.note || 'RoomSplit payment').slice(0, 100),
  });

  return {
    upi: `upi://pay?${query}`,
    gpay: `tez://upi/pay?${query}`,
    phonepe: `phonepe://pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
  };
}

/** @deprecated Use buildUpiPaymentLinks */
export function buildUpiPaymentLink(options: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  return buildUpiPaymentLinks(options).upi;
}

export function suggestedPayAmount(myBalance: number, theirBalance: number): number | null {
  if (myBalance >= 0 || theirBalance <= 0) return null;
  const amount = Math.min(Math.abs(myBalance), theirBalance);
  return amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function openPaymentLink(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
