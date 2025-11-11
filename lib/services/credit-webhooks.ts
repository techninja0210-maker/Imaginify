import { randomUUID, createHmac } from "crypto";

const WEBHOOK_URLS_ENV = "CREDIT_WEBHOOK_URLS";
const WEBHOOK_SECRET_ENV = "CREDIT_WEBHOOK_SECRET";

type CreditWebhookEvent =
  | "credits.deduction.succeeded"
  | "credits.deduction.failed"
  | "credits.low_balance"
  | "credits.refund.succeeded"
  | "credits.refund.failed";

type DispatchOptions = {
  retries?: number;
};

export async function dispatchCreditEvent(
  type: CreditWebhookEvent,
  data: Record<string, any>,
  options: DispatchOptions = {}
) {
  const urls = (process.env[WEBHOOK_URLS_ENV] || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!urls.length) {
    return;
  }

  const timestamp = new Date().toISOString();
  const id = randomUUID();
  const body = JSON.stringify({
    id,
    type,
    createdAt: timestamp,
    data,
  });

  const secret =
    process.env[WEBHOOK_SECRET_ENV] || process.env.SHARED_HMAC_SECRET || "";

  const signature = secret
    ? createWebhookSignature(type, timestamp, body, secret)
    : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": type,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Id": id,
  };

  if (signature) {
    headers["X-Webhook-Signature"] = signature;
  }

  await Promise.all(
    urls.map(async (url) => {
      const attempts = options.retries ?? 0;
      let lastError: any = null;

      for (let attempt = 0; attempt <= attempts; attempt++) {
        try {
          await fetch(url, {
            method: "POST",
            headers,
            body,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (lastError) {
        console.error(`[CREDIT_WEBHOOK] Failed to dispatch to ${url}`, lastError);
      }
    })
  );
}

function createWebhookSignature(
  type: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const content = `${type}\n${timestamp}\n${body}`;
  return createHmac("sha256", secret).update(content, "utf8").digest("hex");
}


