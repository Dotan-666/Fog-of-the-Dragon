/**
 * Lemon Squeezy: everything provider-specific, as pure functions (no network, no database), so it can be tested and,
 * if the provider is ever changed (for example to Paddle), replaced without touching the pages or the database rules.
 *
 *   verifySignature      X-Signature = lowercase hex HMAC-SHA256 of the RAW request body with the webhook signing secret
 *   buildCheckoutBody    POST https://api.lemonsqueezy.com/v1/checkouts (JSON:API); our ids travel in checkout_data.custom
 *                        and come back in the webhook's meta.custom_data
 *   interpretEvent       a webhook payload → what to do in OUR database ('plan' | 'book' | 'ignore')
 *
 * Docs: https://docs.lemonsqueezy.com/api/checkouts/create-checkout · /help/webhooks/signing-requests · /help/checkout/passing-custom-data
 */

export type ProductKey = 'plan_adventurer_monthly' | 'plan_adventurer_yearly' | 'plan_dm_monthly' | 'plan_dm_yearly' | 'one_shot' | 'campaign_book_digital';

export const PRODUCTS: Record<ProductKey, { kind: 'plan'; planId: 'adventurer' | 'dungeon-master' } | { kind: 'book' } | { kind: 'one_shot' }> = {
  plan_adventurer_monthly: { kind: 'plan', planId: 'adventurer' },
  plan_adventurer_yearly: { kind: 'plan', planId: 'adventurer' },
  plan_dm_monthly: { kind: 'plan', planId: 'dungeon-master' },
  plan_dm_yearly: { kind: 'plan', planId: 'dungeon-master' },
  one_shot: { kind: 'one_shot' },
  campaign_book_digital: { kind: 'book' },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProductKey(x: unknown): x is ProductKey {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(PRODUCTS, x);
}

/** LS_VARIANTS is JSON: {"plan_dm_monthly":"123", ...}. Returns the map or an error text. */
export function parseVariants(raw: string | undefined): { variants: Partial<Record<ProductKey, string>> } | { error: string } {
  if (!raw) return { error: 'LS_VARIANTS is not set.' };
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return { error: 'LS_VARIANTS is not valid JSON.' }; }
  if (!v || typeof v !== 'object') return { error: 'LS_VARIANTS must be an object.' };
  const out: Partial<Record<ProductKey, string>> = {};
  for (const [k, id] of Object.entries(v as Record<string, unknown>)) {
    if (!isProductKey(k)) return { error: `LS_VARIANTS has an unknown key: ${k}.` };
    if (!/^\d{1,12}$/.test(String(id))) return { error: `LS_VARIANTS.${k} must be a numeric variant id.` };
    out[k] = String(id);
  }
  return { variants: out };
}

export function productForVariant(variantId: string | number, variants: Partial<Record<ProductKey, string>>): ProductKey | null {
  const id = String(variantId);
  for (const [k, v] of Object.entries(variants)) if (v === id) return k as ProductKey;
  return null;
}

const enc = new TextEncoder();
function toHex(buf: ArrayBuffer): string { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); }

/** Constant-time comparison of two strings of any length. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function signBody(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
}

export async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  return safeEqual(await signBody(rawBody, secret), signature.trim().toLowerCase());
}

export interface CheckoutInput {
  storeId: string;
  variantId: string;
  userId: string;
  email?: string | null;
  product: ProductKey;
  campaignId?: string | null;
  redirectUrl: string;
  testMode: boolean;
  expiresAt: string;
}

export function buildCheckoutBody(i: CheckoutInput) {
  const custom: Record<string, string> = { user_id: i.userId, product: i.product };
  if (i.campaignId) custom.campaign_id = i.campaignId;
  return {
    data: {
      type: 'checkouts',
      attributes: {
        product_options: { redirect_url: i.redirectUrl, enabled_variants: [Number(i.variantId)] },
        checkout_data: { ...(i.email ? { email: i.email } : {}), custom },
        expires_at: i.expiresAt,
        test_mode: i.testMode,
      },
      relationships: {
        store: { data: { type: 'stores', id: i.storeId } },
        variant: { data: { type: 'variants', id: i.variantId } },
      },
    },
  };
}

export type Action =
  | { type: 'plan'; userId: string; planId: string; status: 'active' | 'canceled' | 'past_due'; periodEnd: string | null; providerRef: string; customerId: string | null; portalUrl: string | null; updatedAt: string }
  | { type: 'book'; campaignId: string; userId: string; status: 'paid' | 'refunded' | 'failed' | 'pending'; providerRef: string; amountCents: number | null; currency: string | null }
  | { type: 'ignore'; reason: string };

// What each subscription status means for access. Cancelled and expired subscriptions keep their plan until the paid period ends.
const SUB_STATUS: Record<string, 'active' | 'canceled' | 'past_due'> = {
  active: 'active', on_trial: 'active', paused: 'canceled', past_due: 'past_due', unpaid: 'canceled', cancelled: 'canceled', expired: 'canceled',
};

export interface WebhookEvent {
  meta?: { event_name?: string; test_mode?: boolean; custom_data?: Record<string, unknown> };
  data?: { id?: string | number; type?: string; attributes?: Record<string, any> };
}

export function interpretEvent(ev: WebhookEvent, variants: Partial<Record<ProductKey, string>>, opts: { acceptTestMode: boolean }): Action {
  const name = ev?.meta?.event_name || '';
  const a = ev?.data?.attributes || {};
  const custom = (ev?.meta?.custom_data || {}) as Record<string, unknown>;
  if (ev?.meta?.test_mode && !opts.acceptTestMode) return { type: 'ignore', reason: 'test-mode event while live mode is configured' };

  if (name.startsWith('subscription_') && ev?.data?.type === 'subscriptions' && !name.startsWith('subscription_payment_')) {
    const product = productForVariant(a.variant_id, variants);
    const info = product ? PRODUCTS[product] : null;
    if (!info || info.kind !== 'plan') return { type: 'ignore', reason: 'subscription for a product we do not sell as a plan' };
    const userId = String(custom.user_id || '');
    if (!UUID.test(userId)) return { type: 'ignore', reason: 'no valid user id in custom data' };
    const status = SUB_STATUS[String(a.status)];
    if (!status) return { type: 'ignore', reason: `unknown subscription status ${a.status}` };
    // An ended subscription keeps access until ends_at; a running one until the next renewal date.
    const end = status === 'active' ? (a.renews_at || null) : (a.ends_at || a.renews_at || null);
    return {
      type: 'plan', userId, planId: info.planId, status, periodEnd: end, providerRef: String(ev?.data?.id), customerId: a.customer_id != null ? String(a.customer_id) : null,
      portalUrl: a.urls?.customer_portal || null, updatedAt: String(a.updated_at || new Date().toISOString()),
    };
  }

  if (name === 'order_created' || name === 'order_refunded') {
    const variant = a.first_order_item?.variant_id;
    const product = variant != null ? productForVariant(variant, variants) : null;
    if (product !== 'campaign_book_digital') return { type: 'ignore', reason: 'order is not a campaign book (subscriptions are handled by their own events)' };
    const campaignId = String(custom.campaign_id || '');
    const userId = String(custom.user_id || '');
    if (!UUID.test(campaignId) || !UUID.test(userId)) return { type: 'ignore', reason: 'no valid campaign or user id in custom data' };
    const status = name === 'order_refunded' || a.status === 'refunded' ? 'refunded' : a.status === 'paid' ? 'paid' : a.status === 'failed' ? 'failed' : 'pending';
    return { type: 'book', campaignId, userId, status, providerRef: String(ev?.data?.id), amountCents: typeof a.total === 'number' ? a.total : null, currency: a.currency ? String(a.currency) : null };
  }
  return { type: 'ignore', reason: `event ${name || '(none)'} needs no action` };
}
