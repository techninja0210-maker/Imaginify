"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../database/prisma";
import { handleError } from "../utils";
import { isDbDown } from "@/lib/errors";

// ADD JOB
export async function addJob({ job, userId, organizationId, path }: AddJobParams) {
  try {
    const newJob = await prisma.job.create({
      data: {
        ...job,
        // Ensure metadata conforms to Prisma Json type expectations
        metadata: (job as any).metadata as any,
        userId,
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

    revalidatePath(path);
    return JSON.parse(JSON.stringify(newJob));
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

      // Get user with current balance (user-scoped)
      const userWithBalance = await tx.user.findUnique({
        where: { id: user.id },
        select: { creditBalance: true }
      });

      if (!userWithBalance || userWithBalance.creditBalance < quote.totalCredits) {
        throw new Error(`Insufficient credits. Required: ${quote.totalCredits}, Available: ${userWithBalance?.creditBalance || 0}`);
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

      // Deduct credits using user-scoped function (handles ledger + org mirror)
      // Note: This is called inside a transaction, so we need to import deductCredits
      // but it creates its own transaction. For now, we'll do it manually here.
      const ledgerData: any = {
        organizationId: quote.organizationId,
        userId: quote.userId,
        jobId: job.id,
        type: 'deduction',
        amount: -quote.totalCredits,
        reason: `Job creation: ${job.id}`,
        idempotencyKey: `quote:${quoteId}:${Date.now()}`
      };
      await tx.creditLedger.create({ data: ledgerData });

      // Update user balance (user-scoped)
      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { decrement: quote.totalCredits } }
      });

      // Mirror to org balance
      const orgCredits = await tx.creditBalance.findUnique({
        where: { organizationId: quote.organizationId }
      });
      if (orgCredits) {
        await tx.creditBalance.update({
          where: { organizationId: quote.organizationId },
          data: { balance: { decrement: quote.totalCredits } }
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
