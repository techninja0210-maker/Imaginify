export function isDbDown(e: unknown): boolean {
  const msg = (e as any)?.message?.toString?.() || "";
  return (
    msg.includes("P1001") ||
    msg.includes("Can't reach database server") ||
    msg.includes("read-only transaction") ||
    msg.includes("pooler") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT")
  );
}


