"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../database/prisma";
import { handleError } from "../utils";

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

// CONFIRM JOB QUOTE
export async function confirmJobQuote(quoteId: string, userId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the quote
      const quote = await tx.jobQuote.findUnique({
        where: { id: quoteId }
      });

      if (!quote || quote.userId !== userId) {
        throw new Error("Quote not found or unauthorized");
      }

      if (quote.status !== 'active') {
        throw new Error("Quote is no longer active");
      }

      if (quote.expiresAt < new Date()) {
        throw new Error("Quote has expired");
      }

      // Check if user has enough credits
      const balance = await tx.creditBalance.findUnique({
        where: { organizationId: quote.organizationId }
      });

      if (!balance || balance.balance < quote.totalCredits) {
        throw new Error("Insufficient credits");
      }

      // Create job
      const job = await tx.job.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          title: `Job - ${quote.workflowType}`,
          description: `Generated from quote ${quoteId}`,
          quotedCredits: quote.totalCredits,
          quotedAt: new Date(),
          confirmedAt: new Date(),
          status: 'confirmed',
          metadata: quote.parameters as any
        }
      });

      // Deduct credits
      await tx.creditLedger.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          type: 'deduction',
          amount: -quote.totalCredits,
          reason: `Job creation: ${job.id}`
        }
      });

      await tx.creditBalance.update({
        where: { organizationId: quote.organizationId },
        data: { balance: { decrement: quote.totalCredits } }
      });

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
