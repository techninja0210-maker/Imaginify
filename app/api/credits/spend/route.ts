import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/database/prisma";
import { updateCredits } from "@/lib/actions/user.actions";

// Simple HMAC verification using SHARED_HMAC_SECRET
function verifyHmac(body: string, signature: string | null) {
  const secret = process.env.SHARED_HMAC_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hmac-signature");
  if (!verifyHmac(rawBody, signature)) return new NextResponse("Unauthorized", { status: 401 });

  const { organizationId, amount, reason, idempotencyKey } = JSON.parse(rawBody || "{}");
  if (!organizationId || typeof amount !== "number") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Negative amount to deduct
  const delta = Number(amount);
  if (delta === 0) return NextResponse.json({ error: "Amount cannot be zero" }, { status: 400 });

  try {
    const balance = await updateCredits(organizationId, delta, reason || (delta > 0 ? "grant" : "spend"), idempotencyKey);
    return NextResponse.json({ ok: true, balance });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}


