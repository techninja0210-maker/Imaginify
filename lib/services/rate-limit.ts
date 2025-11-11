type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export class RateLimitError extends Error {
  public retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "RateLimitError";
  }
}

export function assertRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
) {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return;
  }

  if (existing.count >= maxRequests) {
    const retryAfterMs = existing.windowStart + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new RateLimitError("Rate limit exceeded", retryAfterSeconds);
  }

  existing.count += 1;
}


