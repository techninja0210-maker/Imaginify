import { NextRequest, NextResponse } from "next/server";
import { deductCredits } from "@/lib/actions/user.actions";
import { auth } from "@clerk/nextjs";
import crypto from "crypto";

// HMAC verification for secure API calls
function verifyHMAC(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      amount, 
      reason = "Video generation", 
      idempotencyKey,
      hmacSignature 
    } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // HMAC verification (if signature provided)
    if (hmacSignature && process.env.SHARED_HMAC_SECRET) {
      const payload = JSON.stringify({ amount, reason, idempotencyKey });
      if (!verifyHMAC(payload, hmacSignature, process.env.SHARED_HMAC_SECRET)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Use the new user-scoped credit deduction
    const result = await deductCredits(userId, amount, reason, idempotencyKey);

    if (!result.success) {
      return NextResponse.json({ 
        message: result.message,
        ledgerId: result.ledgerId 
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      newBalance: result.updatedUser.creditBalance,
      deducted: amount,
      ledgerId: result.ledgerEntry.id
    });

  } catch (error) {
    console.error("Credit deduction error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
