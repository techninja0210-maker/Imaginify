"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "../database/prisma";
import { handleError, requireGmailEmail } from "../utils";
import { isDbDown } from "@/lib/errors";

// CREATE
export async function createUser(user: CreateUserParams) {
  try {
    // Validate Gmail-only sign-in at the function level as well
    requireGmailEmail(user.email, "user creation");
    // Create user with organization and initial credit balance
    const newUser = await prisma.user.create({
      data: {
        clerkId: user.clerkId,
        email: user.email,
        username: user.username,
        photo: user.photo,
        firstName: user.firstName,
        lastName: user.lastName,
        // Create organization for the user
        organizationMembers: {
          create: {
            organization: {
              create: {
                clerkId: `org_${user.clerkId}`,
                name: `${user.firstName} ${user.lastName}'s Organization`,
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
        firstName: clerkUser.firstName || 'User',
        lastName: clerkUser.lastName || 'Name',
        photo: clerkUser.imageUrl,
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

      const ledgerData: any = {
        organizationId,
        userId: user.id,
        type: creditFee > 0 ? 'allocation' : 'deduction',
        amount: creditFee,
        reason,
      };
      if (idempotencyKey) ledgerData.idempotencyKey = idempotencyKey;
      await tx.creditLedger.create({ data: ledgerData });

      // Update user's personal credit balance
      const updatedUser = await tx.user.update({
        where: { clerkId: userId },
        data: { creditBalance: { increment: creditFee } }
      });

      // Verify the update actually happened
      const verifyUser = await tx.user.findUnique({
        where: { clerkId: userId },
        select: { creditBalance: true }
      });

      if (!verifyUser || verifyUser.creditBalance !== (user.creditBalance + creditFee)) {
        throw new Error(`Credit balance update verification failed. Expected: ${user.creditBalance + creditFee}, Got: ${verifyUser?.creditBalance || 'null'}`);
      }

      // Mirror to organization credit_balances for backwards-compat dashboards
      if (organizationId) {
        try {
          const existing = await tx.creditBalance.findUnique({ where: { organizationId } });
          if (existing) {
            await tx.creditBalance.update({ 
              where: { organizationId }, 
              data: { balance: { increment: creditFee } } 
            });
            console.log(`[UPDATE_CREDITS] Updated org balance: orgId=${organizationId}, increment=${creditFee}, newBalance=${existing.balance + creditFee}`);
          } else {
            // Create org balance entry matching user's current balance
            await tx.creditBalance.create({ 
              data: { 
                organizationId, 
                balance: updatedUser.creditBalance, // Use the already-updated user balance
                lowBalanceThreshold: user.lowBalanceThreshold || 10,
                autoTopUpEnabled: false
              } 
            });
            console.log(`[UPDATE_CREDITS] Created org balance: orgId=${organizationId}, balance=${updatedUser.creditBalance}`);
          }
        } catch (orgError: any) {
          console.error(`[UPDATE_CREDITS] Failed to mirror to org balance:`, orgError);
          // Don't fail the whole transaction if org mirror fails - user balance is primary
          // But log it so we can debug
        }
      }

      console.log(`[UPDATE_CREDITS] Successfully updated credits: userId=${userId}, increment=${creditFee}, oldBalance=${user.creditBalance}, newBalance=${updatedUser.creditBalance}`);
      
      // Revalidate cache to ensure fresh data is shown immediately
      revalidatePath('/');
      revalidatePath('/profile');
      revalidatePath('/billing');
      revalidatePath('/credits');
      
      return updatedUser;
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
export async function deductCredits(userId: string, amount: number, reason: string = "Video generation", idempotencyKey?: string) {
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

      // Check sufficient credits
      if (user.creditBalance < amount) {
        throw new Error(`Insufficient credits. Current: ${user.creditBalance}, Required: ${amount}`);
      }

      // Check for duplicate idempotency key
      if (idempotencyKey) {
        const existingLedger = await tx.creditLedger.findUnique({
          where: { idempotencyKey }
        });
        
        if (existingLedger) {
          return { success: false, message: "Transaction already processed", ledgerId: existingLedger.id };
        }
      }

      // Create ledger entry
      const organizationId = user.organizationMembers[0]?.organization?.id;
      const ledgerData: any = {
        organizationId,
        userId: user.id,
        type: 'deduction',
        amount: -amount,
        reason,
      };
      if (idempotencyKey) ledgerData.idempotencyKey = idempotencyKey;
      const ledgerEntry = await tx.creditLedger.create({ data: ledgerData });

      // Update user's credit balance
      const updatedUser = await tx.user.update({
        where: { clerkId: userId },
        data: { creditBalance: { decrement: amount } }
      });

      // Mirror decrement to organization credit_balances
      if (organizationId) {
        const existing = await tx.creditBalance.findUnique({ where: { organizationId } });
        if (existing) {
          await tx.creditBalance.update({ where: { organizationId }, data: { balance: { decrement: amount } } });
        }
      }

      return { success: true, updatedUser, ledgerEntry };
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