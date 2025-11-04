import { prisma } from "@/lib/database/prisma";
import { getUserById } from "@/lib/actions/user.actions";

/**
 * Check if user balance is low and send email notification if needed
 * This function is called after credit deductions to check if we should notify the user
 */
export async function checkAndNotifyLowBalance(userId: string, newBalance: number) {
  try {
    const user = await getUserById(userId);
    if (!user) return { notified: false, reason: "User not found" };

    const userThreshold = user.lowBalanceThreshold || 5;
    const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;

    // Get org threshold if available
    let orgThreshold = userThreshold;
    if (orgId) {
      const orgCredits = await prisma.creditBalance.findUnique({
        where: { organizationId: orgId },
        select: { lowBalanceThreshold: true },
      });
      if (orgCredits?.lowBalanceThreshold) {
        orgThreshold = orgCredits.lowBalanceThreshold;
      }
    }

    const threshold = Math.max(userThreshold, orgThreshold);

    // Only notify if balance is below threshold
    if (newBalance >= threshold) {
      return { notified: false, reason: "Balance above threshold" };
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
        return { notified: false, reason: "Email sent recently" };
      }
    }

    // Log the notification (email will be sent by cron or manually)
    if (orgId) {
      await prisma.creditLedger.create({
        data: {
          organizationId: orgId,
          amount: 0,
          type: "allocation",
          reason: `Low balance email notification queued (Balance: ${newBalance}, Threshold: ${threshold})`,
          metadata: {
            notificationType: "low_balance_email",
            balance: newBalance,
            threshold,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    // TODO: Actually send email here or queue it
    // For now, we'll let the cron job handle the actual email sending
    // This is logged so the cron can pick it up

    return {
      notified: true,
      balance: newBalance,
      threshold,
      message: "Low balance notification queued",
    };
  } catch (error) {
    console.error("Error checking low balance notification:", error);
    return { notified: false, reason: "Error checking notification" };
  }
}

/**
 * Send low balance email notification to a specific user
 * This is called by cron jobs or can be triggered manually
 */
export async function sendLowBalanceEmail(userId: string) {
  try {
    const user = await getUserById(userId);
    if (!user) return { sent: false, reason: "User not found" };

    const userBalance = user.creditBalance || 0;
    const userThreshold = user.lowBalanceThreshold || 5;
    const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;

    let orgThreshold = userThreshold;
    if (orgId) {
      const orgCredits = await prisma.creditBalance.findUnique({
        where: { organizationId: orgId },
        select: { lowBalanceThreshold: true },
      });
      if (orgCredits?.lowBalanceThreshold) {
        orgThreshold = orgCredits.lowBalanceThreshold;
      }
    }

    const threshold = Math.max(userThreshold, orgThreshold);

    if (userBalance >= threshold) {
      return { sent: false, reason: "Balance above threshold" };
    }

    // Check if we've sent an email in the last 24 hours
    if (orgId) {
      const recentEmail = await prisma.creditLedger.findFirst({
        where: {
          organizationId: orgId,
          reason: {
            contains: "Low balance email notification sent",
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentEmail) {
        return { sent: false, reason: "Email sent recently" };
      }
    }

    // TODO: Implement actual email sending
    // Example with Resend:
    /*
    import { Resend } from 'resend';
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    await resend.emails.send({
      from: 'Imaginify <noreply@yourdomain.com>',
      to: user.email,
      subject: `Low Credit Balance Alert - ${userBalance} credits remaining`,
      html: `
        <h1>Low Credit Balance Alert</h1>
        <p>Your Imaginify account balance is currently <strong>${userBalance} credits</strong>, which is below your threshold of <strong>${threshold} credits</strong>.</p>
        <p><a href="${process.env.NEXT_PUBLIC_SERVER_URL || 'https://yourdomain.com'}/credits">Buy More Credits</a></p>
      `,
    });
    */

    // Log the email as sent
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
            email: user.email,
          },
        },
      });
    }

    return {
      sent: true,
      balance: userBalance,
      threshold,
      email: user.email,
      message: "Low balance email notification sent (configure email service to actually send)",
    };
  } catch (error) {
    console.error("Error sending low balance email:", error);
    return { sent: false, reason: "Error sending email" };
  }
}

