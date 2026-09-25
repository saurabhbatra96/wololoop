// 12 - Granola Webhook Receiver
//
// Event shapes follow docs.granola.ai/webhooks. The two crypto helpers are
// given - they're plumbing, not the question.

type WebhookEvent =
  | { event_id: string; event_type: "note.generated"; note_id: string; occurred_at: string }
  | { event_id: string; event_type: "note.edited"; note_id: string; occurred_at: string;
      data: { changed_fields: string[] } }
  | { event_id: string; event_type: "note.access_granted"; note_id: string; occurred_at: string };

type VerifyResult =
  | { ok: true; event: WebhookEvent }
  | { ok: false; reason: "missing_headers" | "bad_signature" | "stale" | "malformed_body" };

interface WebhookRequest {
  headers: Record<string, string>; // lower-case names
  rawBody: string;
}

/** base64 -> bytes */
function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** HMAC-SHA256 of `message` (UTF-8) under `key`, as base64. */
async function hmacSha256Base64(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
  return btoa(String.fromCharCode(...mac));
}

async function verifyWebhook(
  req: WebhookRequest,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300
): Promise<VerifyResult> {
  throw new NotImplementedError("verifyWebhook");
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const secret = "whsec_" + btoa("not-a-real-secret");
  const body = JSON.stringify({ event_id: "evt_1", event_type: "note.generated",
                                note_id: "not_1d3tmYTlCICgjy", occurred_at: "2026-01-27T15:30:00Z" });
  const signature = await hmacSha256Base64(base64ToBytes(secret.slice(6)), "evt_1.1769527800." + body);
  const headers = { "webhook-id": "evt_1", "webhook-timestamp": "1769527800", "webhook-signature": "v1," + signature };
  console.log(await verifyWebhook({ headers, rawBody: body }, secret, 1769527810));
});
