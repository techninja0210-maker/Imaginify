"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../database/prisma";
import { handleError } from "../utils";
import { isDbDown } from "@/lib/errors";

// ADD JOB
export async function addJob({ job, userId, organizationId, path }: AddJobParams) {
  try {
    // Get user to check credits (userId is the database ID, not Clerk ID)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizationMembers: {
          include: { organization: true }
        }
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user has enough credits using the new grant system
    const creditCost = 1; // Default cost, can be made configurable per job type
    
    // Get active credit grants to check availability
    const now = new Date();
    const activeGrants = await prisma.creditGrant.findMany({
      where: {
        userId: user.id,
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
    if (totalAvailable < creditCost) {
      throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${creditCost}. Please top up or upgrade your plan.`);
    }

    // Create job and deduct credits in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the job
      const newJob = await tx.job.create({
        data: {
          ...job,
          // Ensure metadata conforms to Prisma Json type expectations
          metadata: (job as any).metadata as any,
          userId: user.id,
          organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              clerkId: true
            }
          },
          organization: true
        }
      });

      // Deduct from grants in priority order (subscription first, then top-ups)
      let remaining = creditCost;
      const grantDeductions: Array<{ grantId: string; amount: number }> = [];

      // Re-fetch grants within transaction to ensure consistency
      const grantsInTx = await tx.creditGrant.findMany({
        where: {
          userId: user.id,
          expiresAt: { gt: now },
        },
        orderBy: [
          { type: "asc" },
          { expiresAt: "asc" },
        ],
      });

      for (const grant of grantsInTx) {
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

      // Create ledger entry for credit deduction
      const idempotencyKey = `job:${newJob.id}:${Date.now()}`;
      const ledgerEntry = await tx.creditLedger.create({
        data: {
          organizationId,
          userId: user.id,
          jobId: newJob.id,
          type: 'deduction',
          amount: -creditCost,
          reason: `Job creation: ${newJob.id}`,
          idempotencyKey,
          metadata: {
            grantDeductions,
            jobType: job.workflowType || 'unknown',
          },
        }
      });

      // Update user's credit balance (for backward compatibility)
      await tx.user.update({
        where: { id: user.id },
        data: { 
          creditBalance: { decrement: creditCost },
          creditBalanceVersion: { increment: 1 },
        }
      });

      // Mirror to org balance (for backward compatibility)
      const orgCredits = await tx.creditBalance.findUnique({
        where: { organizationId }
      });
      if (orgCredits) {
        await tx.creditBalance.update({
          where: { organizationId },
          data: { 
            balance: { decrement: creditCost },
            version: { increment: 1 },
          }
        });
      }

      return newJob;
    });

    revalidatePath(path);
    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    handleError(error);
  }
}

// UPDATE JOB
export async function updateJob({ job, userId, path }: UpdateJobParams) {
  try {
    const jobToUpdate = await prisma.job.findUnique({
      where: { id: job.id }
    });

    if (!jobToUpdate || jobToUpdate.userId !== userId) {
      throw new Error("Unauthorized or job not found");
    }

    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        ...(job as any),
        metadata: (job as any).metadata as any,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true
          }
        },
        organization: true
      }
    });

    revalidatePath(path);
    return JSON.parse(JSON.stringify(updatedJob));
  } catch (error) {
    handleError(error);
  }
}

// DELETE JOB
export async function deleteJob(jobId: string) {
  try {
    await prisma.job.delete({
      where: { id: jobId }
    });
  } catch (error) {
    handleError(error);
  } finally {
    redirect('/');
  }
}

// GET JOB BY ID
export async function getJobById(jobId: string) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true
          }
        },
        organization: true
      }
    });

    if (!job) throw new Error("Job not found");
    return JSON.parse(JSON.stringify(job));
  } catch (error) {
    handleError(error);
  }
}

// GET ALL JOBS
export async function getAllJobs({ 
  limit = 9, 
  page = 1, 
  searchQuery = '' 
}: {
  limit?: number;
  page: number;
  searchQuery?: string;
}) {
  try {
    const skipAmount = (Number(page) - 1) * limit;

    let whereClause = {};
    
    if (searchQuery) {
      whereClause = {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { workflowType: { contains: searchQuery, mode: 'insensitive' } }
        ]
      };
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true
          }
        },
        organization: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: skipAmount,
      take: limit
    });

    const totalJobs = await prisma.job.count({
      where: whereClause
    });

    const savedJobs = await prisma.job.count();

    return {
      data: JSON.parse(JSON.stringify(jobs)),
      totalPage: Math.ceil(totalJobs / limit),
      savedJobs,
    };
  } catch (error) {
    if (isDbDown(error)) {
      return { data: [], totalPage: 1, savedJobs: 0, dbDown: true } as any;
    }
    handleError(error);
  }
}

// GET JOBS BY USER
export async function getUserJobs({
  limit = 9,
  page = 1,
  userId,
}: {
  limit?: number;
  page: number;
  userId: string;
}) {
  try {
    const skipAmount = (Number(page) - 1) * limit;

    const jobs = await prisma.job.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true
          }
        },
        organization: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: skipAmount,
      take: limit
    });

    const totalJobs = await prisma.job.count({
      where: { userId }
    });

    return {
      data: JSON.parse(JSON.stringify(jobs)),
      totalPages: Math.ceil(totalJobs / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// GET JOBS BY ORGANIZATION
export async function getOrganizationJobs({
  limit = 9,
  page = 1,
  organizationId,
}: {
  limit?: number;
  page: number;
  organizationId: string;
}) {
  try {
    const skipAmount = (Number(page) - 1) * limit;

    const jobs = await prisma.job.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true
          }
        },
        organization: true
      },
      orderBy: { updatedAt: 'desc' },
      skip: skipAmount,
      take: limit
    });

    const totalJobs = await prisma.job.count({
      where: { organizationId }
    });

    return {
      data: JSON.parse(JSON.stringify(jobs)),
      totalPages: Math.ceil(totalJobs / limit),
    };
  } catch (error) {
    handleError(error);
  }
}

// CREATE JOB QUOTE
export async function createJobQuote({
  organizationId,
  userId,
  workflowType,
  parameters,
  totalCredits,
  breakdown,
  expiresAt
}: CreateJobQuoteParams) {
  try {
    const quote = await prisma.jobQuote.create({
      data: {
        organizationId,
        userId,
        workflowType,
        parameters,
        totalCredits,
        breakdown,
        expiresAt
      }
    });

    return JSON.parse(JSON.stringify(quote));
  } catch (error) {
    handleError(error);
  }
}

// CONFIRM JOB QUOTE (DEPRECATED - Use POST /api/jobs instead)
// Kept for backward compatibility but uses user-scoped credits now
export async function confirmJobQuote(quoteId: string, userId: string) {
  try {
    // Get user to resolve clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      throw new Error("User not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get the quote
      const quote = await tx.jobQuote.findUnique({
        where: { id: quoteId }
      });

      if (!quote || quote.userId !== user.id) {
        throw new Error("Quote not found or unauthorized");
      }

      if (quote.status !== 'active') {
        throw new Error("Quote is no longer active");
      }

      if (quote.expiresAt < new Date()) {
        throw new Error("Quote has expired");
      }

      // Check user has enough credits using the new grant system
      const now = new Date();
      const activeGrants = await tx.creditGrant.findMany({
        where: {
          userId: user.id,
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

      if (totalAvailable < quote.totalCredits) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${quote.totalCredits}. Please top up or upgrade your plan.`);
      }

      // Create job
      const job = await tx.job.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          title: `Job - ${quote.workflowType}`,
          description: `Generated from quote ${quoteId}`,
          quotedCredits: quote.totalCredits,
          quotedAt: quote.createdAt,
          confirmedAt: new Date(),
          status: 'confirmed',
          totalRetailCostCredits: quote.totalCredits,
          totalInternalCostUsd: (quote.breakdown as any)?.internalUsd || null,
          metadata: quote.parameters as any
        }
      });

      // Deduct from grants in priority order (subscription first, then top-ups)
      let remaining = quote.totalCredits;
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

      // Create ledger entry
      const idempotencyKey = `quote:${quoteId}:${Date.now()}`;
      await tx.creditLedger.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          jobId: job.id,
          type: 'deduction',
          amount: -quote.totalCredits,
          reason: `Job creation: ${job.id}`,
          idempotencyKey,
          metadata: {
            grantDeductions,
            workflowType: quote.workflowType,
          },
        }
      });

      // Update user balance (for backward compatibility)
      await tx.user.update({
        where: { id: user.id },
        data: { 
          creditBalance: { decrement: quote.totalCredits },
          creditBalanceVersion: { increment: 1 },
        }
      });

      // Mirror to org balance (for backward compatibility)
      const orgCredits = await tx.creditBalance.findUnique({
        where: { organizationId: quote.organizationId }
      });
      if (orgCredits) {
        await tx.creditBalance.update({
          where: { organizationId: quote.organizationId },
          data: { 
            balance: { decrement: quote.totalCredits },
            version: { increment: 1 },
          }
        });
      }

      // Mark quote as used
      await tx.jobQuote.update({
        where: { id: quoteId },
        data: { status: 'used' }
      });

      return job;
    });

    return JSON.parse(JSON.stringify(result));
  } catch (error) {
    handleError(error);
  }
}
