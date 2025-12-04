import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/actions/user.actions";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * Send low balance email notification
 * This endpoint can be called by cron jobs or triggered by balance changes
 * 
 * Note: This is a placeholder. To send actual emails, you'll need to:
 * 1. Install an email service (Resend, SendGrid, Nodemailer, etc.)
 * 2. Add EMAIL_API_KEY to your environment variables
 * 3. Implement the actual email sending logic
 */
export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userBalance = user.creditBalance || 0;
    const userThreshold = user.lowBalanceThreshold || 5;

    // Get org threshold
    const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
    let orgThreshold = userThreshold;
    
    if (orgId) {
      const orgCredits = await prisma.creditBalance.findUnique({
        where: { organizationId: orgId },
        select: {
          lowBalanceThreshold: true,
        },
      });
      if (orgCredits?.lowBalanceThreshold) {
        orgThreshold = orgCredits.lowBalanceThreshold;
      }
    }

    const threshold = Math.max(userThreshold, orgThreshold);

    // Only send if balance is actually low
    if (userBalance >= threshold) {
      return NextResponse.json({
        sent: false,
        reason: "Balance is above threshold",
      });
    }

    // Check if we've sent an email in the last 24 hours
    if (orgId) {
      const recentEmail = await prisma.creditLedger.findFirst({
        where: {
          organizationId: orgId,
          reason: {
            contains: "Low balance email notification",
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentEmail) {
        return NextResponse.json({
          sent: false,
          reason: "Email already sent in last 24 hours",
        });
      }
    }

    // TODO: Implement actual email sending
    // Example with Resend (uncomment and configure):
    /*
    import { Resend } from 'resend';
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'Shoppable Videos <noreply@yourdomain.com>',
      to: user.email,
      subject: `Low Credit Balance Alert - ${userBalance} credits remaining`,
      html: `
        <h1>Low Credit Balance Alert</h1>
        <p>Your Shoppable Videos account balance is currently <strong>${userBalance} credits</strong>, which is below your threshold of <strong>${threshold} credits</strong>.</p>
        <p><a href="${process.env.NEXT_PUBLIC_SERVER_URL || 'https://yourdomain.com'}/credits">Buy More Credits</a></p>
      `,
    });
    */

    // Log the email notification in the ledger
    if (orgId) {
      await prisma.creditLedger.create({
        data: {
          organizationId: orgId,
          amount: 0,
          type: "allocation",
          reason: `Low balance email notification sent (Balance: ${userBalance}, Threshold: ${threshold})`,
          metadata: {
            notificationType: "low_balance_email",
            balance: userBalance,
            threshold,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      sent: true,
      message: "Low balance email notification sent (placeholder - configure email service)",
      balance: userBalance,
      threshold,
    });
  } catch (error) {
    console.error("Error sending low balance email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

