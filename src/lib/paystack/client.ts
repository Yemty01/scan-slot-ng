/**
 * Paystack server-side client (uses secret key).
 * Only use in server routes / server actions.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

export interface InitializeTransactionParams {
  /** Amount in major units (e.g. NGN 5000.00). Will be converted to kobo for NGN. */
  amount: number;
  /** Customer email */
  email: string;
  /** Unique reference (e.g. payment record reference). Alphanumeric, -, ., = only */
  reference: string;
  /** URL to redirect after payment */
  callback_url: string;
  /** Currency code, default NGN */
  currency?: string;
  /** Optional metadata (object will be stringified) */
  metadata?: Record<string, unknown>;
  /** Preferred channels: card, bank, ussd, qr, mobile_money, bank_transfer */
  channels?: string[];
}

export interface InitializeTransactionResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * Convert amount to subunit (kobo for NGN, pesewas for GHS, etc.)
 */
function toSubunit(amount: number, currency: string): number {
  const minorUnits = ["NGN", "GHS", "ZAR"].includes(currency.toUpperCase()) ? 100 : 100;
  return Math.round(amount * minorUnits);
}

/**
 * Initialize a Paystack transaction. Returns the URL to redirect the customer to.
 */
export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResponse> {
  const secret = getSecretKey();
  const currency = params.currency ?? "NGN";
  const amountInSubunit = toSubunit(params.amount, currency);

  const body = {
    email: params.email,
    amount: amountInSubunit,
    reference: params.reference,
    callback_url: params.callback_url,
    currency,
    metadata: params.metadata ?? undefined,
    channels: params.channels ?? undefined,
  };

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };

  if (!res.ok || !data.status || !data.data) {
    const msg = data.message ?? `Paystack error: ${res.status}`;
    throw new Error(msg);
  }

  return {
    authorization_url: data.data.authorization_url,
    access_code: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Generate a unique Paystack reference for a payment (alphanumeric + hyphen).
 */
export function generatePaystackReference(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `pay_${timestamp}_${random}`.replace(/[^a-zA-Z0-9_-]/g, "");
}
