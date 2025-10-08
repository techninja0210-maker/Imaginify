"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "../database/prisma";
import { handleError } from "../utils";

// CREATE
export async function createUser(user: CreateUserParams) {
  try {
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
    if (!user) {
      console.log(`User ${userId} not found, creating new user...`);
      
      // Get user info from Clerk
      const { clerkClient } = await import('@clerk/nextjs/server');
      const clerkUser = await clerkClient.users.getUser(userId);
      
      const newUserData = {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0].emailAddress,
        username: clerkUser.username || `user_${clerkUser.id.slice(0, 8)}`,
        firstName: clerkUser.firstName || 'User',
        lastName: clerkUser.lastName || 'Name',
        photo: clerkUser.imageUrl,
      };

      user = await createUser(newUserData as any);
    }

    return JSON.parse(JSON.stringify(user));
  } catch (error) {
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

// USE CREDITS (Updated for new ledger system)
export async function updateCredits(organizationId: string, creditFee: number, reason: string = "Credit usage", idempotencyKey?: string) {
  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create ledger entry
      await tx.creditLedger.create({
        data: {
          organizationId,
          type: creditFee > 0 ? 'allocation' : 'deduction',
          amount: creditFee,
          reason,
          idempotencyKey
        }
      });

      // Update balance
      const updatedBalance = await tx.creditBalance.update({
        where: { organizationId },
        data: { balance: { increment: creditFee } }
      });

      return updatedBalance;
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