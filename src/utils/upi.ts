import { formatUpiAmount } from './currency';

export type UpiPaymentLinks = {
  upi: string;
  gpay: string;
  phonepe: string;
  paytm: string;
};

const UPI_PARAM_ORDER = ['pa', 'pn', 'tr', 'tn', 'am', 'cu'] as const;

function sanitizeUpiText(value: string, maxLength: number): string {
  return value
    .replace(/[^\w\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function isValidUpiVpa(upiId: string | null | undefined): boolean {
  if (!upiId?.trim()) return false;
  return /^[a-z0-9._-]+@[a-z0-9]+$/i.test(upiId.trim());
}

function normalizeUpiVpa(upiId: string): string {
  const vpa = upiId.trim().toLowerCase();
  if (!isValidUpiVpa(vpa)) {
    throw new Error(
      'Invalid UPI ID. Ask your roommate to set a full UPI address like name@upi in Profile.'
    );
  }
  return vpa;
}

function buildUpiQueryString(params: Record<string, string>): string {
  return UPI_PARAM_ORDER.filter((key) => params[key])
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

export function buildUpiPaymentLinks(options: {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}): UpiPaymentLinks {
  const pa = normalizeUpiVpa(options.upiId);

  if (!Number.isFinite(options.amount) || options.amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  if (options.amount > 100000) {
    throw new Error('UPI amount cannot exceed Rs 1,00,000');
  }

  const params = {
    pa,
    pn: sanitizeUpiText(options.payeeName, 50) || 'Payee',
    tr: sanitizeUpiText(options.transactionRef || `RS${Date.now()}`, 35).replace(/\s/g, ''),
    tn: sanitizeUpiText(options.note || 'RoomSplit payment', 50),
    am: formatUpiAmount(options.amount),
    cu: 'INR',
  };

  const query = buildUpiQueryString(params);

  return {
    upi: `upi://pay?${query}`,
    gpay: `gpay://upi/pay?${query}`,
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

export function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

export function openPaymentLink(url: string) {
  // Custom URL schemes open more reliably via location navigation on mobile browsers.
  window.location.assign(url);
}
