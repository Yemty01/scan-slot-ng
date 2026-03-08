import crypto from "node:crypto";

/**
 * Verify Paystack webhook signature.
 * Paystack signs the raw body with HMAC SHA512 using your secret key.
 * @param rawBody - Raw request body as string (must not be parsed JSON)
 * @param signature - Value of x-paystack-signature header
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const hashBuf = Buffer.from(hash, "utf8");
  if (sigBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, hashBuf);
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    id?: number;
    status?: string;
    gateway_response?: string;
    channel?: string;
    [key: string]: unknown;
  };
}

/**
 * Parse webhook body. Use after verifying signature.
 */
export function parseWebhookBody(rawBody: string): PaystackWebhookEvent | null {
  try {
    return JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return null;
  }
}

/** Events we care about */
export const PAYSTACK_EVENT_CHARGE_SUCCESS = "charge.success";
