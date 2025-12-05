"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "../database/prisma";
import { handleError, requireGmailEmail } from "../utils";
import { isDbDown } from "@/lib/errors";

// CREATE
export async function createUser(user: CreateUserParams) {
  try {
    // Validate Gmail-only sign-in at the function level as well
    requireGmailEmail(user.email, "user creation");
    
    // Handle username conflicts - if username already exists, append random suffix
    let finalUsername = user.username;
    let attempt = 0;
    const maxAttempts = 10;
    
    while (attempt < maxAttempts) {
      const existingUser = await prisma.user.findUnique({
        where: { username: finalUsername },
        select: { id: true }
      });
      
      if (!existingUser) {
        break; // Username is available
      }
      
      // Username exists, try with suffix
      attempt++;
      const suffix = attempt > 1 ? `${attempt}` : Math.random().toString(36).slice(2, 6);
      finalUsername = `${user.username}_${suffix}`;
    }
    
    if (attempt >= maxAttempts) {
      throw new Error(`Failed to generate unique username after ${maxAttempts} attempts`);
    }
    
    // Generate organization name
    const orgName = user.firstName || user.lastName
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() + "'s Organization"
      : user.username 
        ? `${user.username}'s Organization`
        : "User's Organization";
    
    // Create user with organization and initial credit balance
    const newUser = await prisma.user.create({
      data: {
        clerkId: user.clerkId,
        email: user.email,
        username: finalUsername,
        photo: user.photo,
        firstName: user.firstName,
        lastName: user.lastName,
        // Create organization for the user
        organizationMembers: {
          create: {
            organization: {
              create: {
                clerkId: `org_${user.clerkId}`,
                name: orgName,
                credits: {
                  create: {
                    balance: 10 // Default starting credits
                  }
                }
              }
            },
            role: 'owner'
          }
        }
      },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true
              }
            }
          }
        }
      }
    });

    return JSON.parse(JSON.stringify(newUser));
  } catch (error) {
    handleError(error);
  }
}

// READ
export async function getUserById(userId: string) {
  try {
    // Revalidate cache to ensure fresh data
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/billing');
    
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true
              }
            }
          }
        }
      }
    });

    // If user doesn't exist, create them (for development/testing)
    // Note: This should rarely happen since webhook handles user creation
    // But it's a fallback for edge cases
    if (!user) {
      console.log(`User ${userId} not found, creating new user...`);
      
      // Get user info from Clerk
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerkUser = await clerkClient.users.getUser(userId);
      
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      
      // Validate Gmail before creating (createUser also validates, but check here first)
      if (email) {
        requireGmailEmail(email, "user lookup");
      } else {
        throw new Error("No email address found for user");
      }
      
      const newUserData = {
        clerkId: clerkUser.id,
        email: email,
        username: clerkUser.username || `user_${clerkUser.id.slice(0, 8)}`,
        // Set default values "User" and "Name" if not provided
        firstName: clerkUser.firstName || 'User',
        lastName: clerkUser.lastName || 'Name',
        photo: clerkUser.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Buffer.from(email.toLowerCase()).toString('base64').slice(0, 10)}`,
      };

      user = await createUser(newUserData as any);
    }

    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    if (isDbDown(error)) {
      return null as any;
    }
    handleError(error);
  }
}

// UPDATE
export async function updateUser(clerkId: string, user: UpdateUserParams) {
  try {
    const updatedUser = await prisma.user.update({
      where: { clerkId },
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photo: user.photo,
      },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true
              }
            }
          }
        }
      }
    });

    return JSON.parse(JSON.stringify(updatedUser));
  } catch (error) {
    handleError(error);
  }
}

// DELETE
export async function deleteUser(clerkId: string) {
  try {
    // Delete user (cascade will handle related records)
    const deletedUser = await prisma.user.delete({
      where: { clerkId }
    });
    
    revalidatePath("/");

    return JSON.parse(JSON.stringify(deletedUser));
  } catch (error) {
    handleError(error);
  }
}

// USE CREDITS (User-scoped version)
export async function updateCredits(userId: string, creditFee: number, reason: string = "Credit usage", idempotencyKey?: string) {
  try {
    // Quick database health check before transaction
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbCheckError: any) {
      const dbErrorMsg = dbCheckError?.message || '';
      if (
        dbErrorMsg.includes('P1001') ||
        dbErrorMsg.includes("Can't reach database server") ||
        dbErrorMsg.includes('Transaction API error') ||
        dbErrorMsg.includes('Unable to start a transaction')
      ) {
        throw new Error(
          'Database connection failed. Your Neon database may be paused. ' +
          'Please resume it in the Neon dashboard and try again.'
        );
      }
      // If it's a different error, continue and let the transaction handle it
    }

    // Use transaction to ensure atomicity with timeout
    const result = await prisma.$transaction(async (tx) => {
      // Create ledger entry (still using organizationId for compatibility)
      let user = await tx.user.findUnique({
        where: { clerkId: userId },
        include: {
          organizationMembers: {
            include: { organization: true }
          }
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Auto-create organization if user doesn't have one
      let organizationId: string;
      if (!user.organizationMembers.length) {
        console.log(`[UPDATE_CREDITS] User ${userId} has no organization, creating one automatically`);
        const organization = await tx.organization.create({
          data: {
            clerkId: `org_${user.clerkId}`,
            name: `${user.firstName || user.username || 'User'}'s Organization`,
            credits: {
              create: {
                balance: user.creditBalance || 0,
                lowBalanceThreshold: user.lowBalanceThreshold || 10,
                autoTopUpEnabled: false
              }
            }
          }
        });

        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: 'owner'
          }
        });

        organizationId = organization.id;
        
        // Refresh user data to include the new organization
        const refreshedUser = await tx.user.findUnique({
          where: { clerkId: userId },
          include: {
            organizationMembers: {
              include: { organization: true }
            }
          }
        });
        
        if (refreshedUser) {
          user = refreshedUser;
        }
      } else {
        organizationId = user.organizationMembers[0].organization.id;
      }

      if (idempotencyKey) {
        const existingLedger = await tx.creditLedger.findUnique({
          where: { idempotencyKey }
        });

        if (existingLedger) {
          console.log(`[UPDATE_CREDITS] Skipping duplicate allocation for idempotencyKey=${idempotencyKey}`);
          const existingUser = await tx.user.findUnique({
            where: { clerkId: userId }
          });
          if (existingUser) {
            return existingUser;
          }
        }
      }

      const currentVersion = user.creditBalanceVersion;
      const newBalance = user.creditBalance + creditFee;

      const updateResult = await tx.user.updateMany({
        where: { clerkId: userId, creditBalanceVersion: currentVersion },
        data: {
          creditBalance: { increment: creditFee },
          creditBalanceVersion: { increment: 1 }
        }
      });

      if (updateResult.count === 0) {
        throw new Error("BALANCE_VERSION_CONFLICT");
      }

      const updatedUser = await tx.user.findUnique({
        where: { clerkId: userId }
      });

      if (!updatedUser) {
        throw new Error("User not found after credit update");
      }

      const ledgerData: any = {
        organizationId,
        userId: updatedUser.id,
        type: creditFee > 0 ? 'allocation' : 'deduction',
        amount: creditFee,
        reason,
        balanceAfter: updatedUser.creditBalance,
        idempotencyKey: idempotencyKey || undefined,
        metadata: {
          previousBalance: user.creditBalance,
          delta: creditFee,
        }
      };

      const ledgerEntry = await tx.creditLedger.create({ data: ledgerData });

      // Mirror to organization credit_balances for backwards-compat dashboards
      if (organizationId) {
        try {
          const existing = await tx.creditBalance.findUnique({ 
            where: { organizationId },
            select: {
              id: true,
              organizationId: true,
              balance: true,
              version: true,
            }
          });
          if (existing) {
            const orgUpdateResult = await tx.creditBalance.updateMany({
              where: { organizationId, version: existing.version },
              data: {
                balance: { increment: creditFee },
                version: { increment: 1 }
              }
            });

            if (orgUpdateResult.count === 0) {
              throw new Error("ORG_BALANCE_VERSION_CONFLICT");
            }

            console.log(`[UPDATE_CREDITS] Updated org balance: orgId=${organizationId}, increment=${creditFee}, newBalance=${existing.balance + creditFee}`);
          } else {
            await tx.creditBalance.create({ 
              data: { 
                organizationId, 
                balance: updatedUser.creditBalance,
                lowBalanceThreshold: user.lowBalanceThreshold || 10,
                autoTopUpEnabled: false
              } 
            });
            console.log(`[UPDATE_CREDITS] Created org balance: orgId=${organizationId}, balance=${updatedUser.creditBalance}`);
          }
        } catch (orgError: any) {
          console.error(`[UPDATE_CREDITS] Failed to mirror to org balance:`, orgError);
        }
      }

      console.log(`[UPDATE_CREDITS] Successfully updated credits: userId=${userId}, increment=${creditFee}, oldBalance=${user.creditBalance}, newBalance=${updatedUser.creditBalance}`);
      
      // Revalidate cache to ensure fresh data is shown immediately
      revalidatePath('/');
      revalidatePath('/profile');
      revalidatePath('/billing');
      revalidatePath('/credits');
      
      return { ...updatedUser, ledgerEntry };
    }, {
      maxWait: 10000, // Maximum time to wait for a transaction slot (10 seconds)
      timeout: 20000, // Maximum time for the transaction to complete (20 seconds)
    });

    return JSON.parse(JSON.stringify(result));
  } catch (error: any) {
    console.error('updateCredits error:', error);
    
    // Check for database connection errors
    const errorMessage = error?.message || '';
    if (
      errorMessage.includes('Transaction API error') ||
      errorMessage.includes('Unable to start a transaction') ||
      errorMessage.includes('P1001') ||
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes('timeout')
    ) {
      throw new Error(
        'Database connection timeout. The database may be paused. ' +
        'Please try again in a few seconds, or check if the Neon database needs to be resumed.'
      );
    }
    
    // Re-throw with original message
    throw new Error(`Failed to update credits: ${errorMessage || 'Unknown error'}`);
  }
}

// DEDUCT CREDITS (User-scoped version)
type CreditBreakdownItem = {
  platform: string;
  action: string;
  units?: number;
  unit_type?: string;
  unitType?: string;
  unit_price?: number;
  unitPrice?: number;
  subtotal?: number;
};

type DeductCreditsOptions = {
  metadata?: Record<string, any>;
  breakdown?: CreditBreakdownItem[];
  clientId?: string;
  environment?: "production" | "sandbox";
  externalJobId?: string;
  status?: string;
};

export async function deductCredits(
  userId: string,
  amount: number,
  reason: string = "Video generation",
  idempotencyKey?: string,
  options: DeductCreditsOptions = {}
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get user with current balance
      const user = await tx.user.findUnique({
        where: { clerkId: userId },
        include: {
          organizationMembers: {
            include: { organization: true }
          }
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      const environment = options.environment || "production";

      // Sandbox mode returns simulated result
      if (environment === "sandbox") {
        return {
          success: true,
          sandbox: true,
          updatedUser: user,
          simulatedBalance: user.creditBalance - amount,
          ledgerEntry: null,
          idempotent: false,
        };
      }

      // Check for duplicate idempotency key
      if (idempotencyKey) {
        const existingLedger = await tx.creditLedger.findUnique({
          where: { idempotencyKey }
        });
        
        if (existingLedger) {
          return {
            success: true,
            idempotent: true,
            updatedUser: await tx.user.findUnique({ where: { clerkId: userId } }),
            ledgerEntry: existingLedger
          };
        }
      }

      // Refresh user after idempotency check (in case of changes)
      const freshUser = await tx.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          creditBalance: true,
          creditBalanceVersion: true,
        }
      });

      if (!freshUser) {
        throw new Error("User not found");
      }

      // NEW: Use credit grants system for deduction
      // Get active grants and check availability
      const now = new Date();
      const activeGrants = await tx.creditGrant.findMany({
        where: {
          userId: freshUser.id,
          expiresAt: { gt: now },
        },
        orderBy: [
          { type: "asc" }, // SUBSCRIPTION first
          { expiresAt: "asc" }, // Earliest expiring first
        ],
      });

      // Calculate total available credits
      let totalAvailable = 0;
      for (const grant of activeGrants) {
        const available = grant.amount - grant.usedAmount;
        if (available > 0) {
          totalAvailable += available;
        }
      }

      // Check sufficient credits
      if (totalAvailable < amount) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${amount}`);
      }

      // Deduct from grants in priority order
      let remaining = amount;
      const grantDeductions: Array<{ grantId: string; amount: number }> = [];

      for (const grant of activeGrants) {
        if (remaining <= 0) break;

        const available = grant.amount - grant.usedAmount;
        if (available <= 0) continue; // Skip exhausted grants

        const toDeduct = Math.min(remaining, available);

        // Update grant
        await tx.creditGrant.update({
          where: { id: grant.id },
          data: {
            usedAmount: { increment: toDeduct },
          },
        });

        grantDeductions.push({
          grantId: grant.id,
          amount: toDeduct,
        });

        remaining -= toDeduct;
      }

      if (remaining > 0) {
        throw new Error(`Failed to deduct all credits. Remaining: ${remaining}`);
      }

      // Update user balance (for backward compatibility and display)
      const currentVersion = freshUser.creditBalanceVersion;
      const newBalance = freshUser.creditBalance - amount;

      const updateResult = await tx.user.updateMany({
        where: { clerkId: userId, creditBalanceVersion: currentVersion },
        data: {
          creditBalance: { decrement: amount },
          creditBalanceVersion: { increment: 1 }
        }
      });

      if (updateResult.count === 0) {
        const conflictError: any = new Error("Balance version conflict");
        conflictError.code = "BALANCE_VERSION_CONFLICT";
        throw conflictError;
      }

      const updatedUser = await tx.user.findUnique({
        where: { clerkId: userId }
      });

      if (!updatedUser) {
        throw new Error("User not found after deduction");
      }

      // Mirror decrement to organization credit_balances
      const organizationId = user.organizationMembers[0]?.organization?.id;
      if (organizationId) {
        const existing = await tx.creditBalance.findUnique({ 
          where: { organizationId },
          select: {
            id: true,
            organizationId: true,
            balance: true,
            version: true,
          }
        });
        if (existing) {
          const orgUpdateResult = await tx.creditBalance.updateMany({
            where: { organizationId, version: existing.version },
            data: {
              balance: { decrement: amount },
              version: { increment: 1 }
            }
          });

          if (orgUpdateResult.count === 0) {
            const orgConflict: any = new Error("Organization balance version conflict");
            orgConflict.code = "BALANCE_VERSION_CONFLICT";
            throw orgConflict;
          }
        }
      }

      const breakdown = options.breakdown?.map((item) => ({
        platform: item.platform,
        action: item.action,
        units: item.units ?? item.unit_type,
        unitType: item.unitType ?? item.unit_type,
        unitPrice: item.unitPrice ?? item.unit_price,
        subtotal: item.subtotal,
      }));

      const ledgerMetadataRaw = options.metadata && typeof options.metadata === "object"
        ? {
            ...options.metadata,
            clientId: options.clientId,
            externalJobId: options.externalJobId,
          }
        : {
            clientId: options.clientId,
            externalJobId: options.externalJobId,
          };

      const ledgerMetadata = Object.fromEntries(
        Object.entries(ledgerMetadataRaw).filter(([_, value]) => value !== undefined && value !== null)
      );

      const metadataValue =
        Object.keys(ledgerMetadata).length > 0
          ? (ledgerMetadata as Prisma.InputJsonValue)
          : undefined;

      const breakdownValue = breakdown
        ? (breakdown as Prisma.InputJsonValue)
        : undefined;

      // Include grant deduction details in metadata
      const enhancedMetadata = {
        ...(ledgerMetadata as Record<string, any>),
        grantDeductions: grantDeductions, // Track which grants were used
      };

      const enhancedMetadataValue =
        Object.keys(enhancedMetadata).length > 0
          ? (enhancedMetadata as Prisma.InputJsonValue)
          : undefined;

      const ledgerEntry = await tx.creditLedger.create({
        data: {
          organizationId,
          userId: updatedUser.id,
          type: 'deduction',
          amount: -amount,
          reason,
          metadata: enhancedMetadataValue,
          idempotencyKey: idempotencyKey || undefined,
          externalJobId: options.externalJobId || undefined,
          clientId: options.clientId || undefined,
          environment,
          breakdown: breakdownValue,
          balanceAfter: updatedUser.creditBalance,
          status: options.status || "completed",
        }
      });

      return { success: true, updatedUser, ledgerEntry, idempotent: false, grantDeductions };
    });

    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    handleError(error);
  }
}

// GET USER'S ORGANIZATION ID
export async function getUserOrganizationId(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        organizationMembers: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user || !user.organizationMembers.length) {
      throw new Error("User organization not found");
    }

    return user.organizationMembers[0].organization.id;
  } catch (error) {
    handleError(error);
  }
}

// Set Stripe customer ID for a user (by Clerk userId)
// (Removed) setUserStripeCustomerId manual setter per request