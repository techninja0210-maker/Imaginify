import { NextRequest, NextResponse } from 'next/server';
import { validateHMACRequest } from '@/lib/middleware/hmac';
import { prisma } from '@/lib/database/prisma';
import { deductCredits } from '@/lib/actions/user.actions';

export const dynamic = "force-dynamic";

/**
 * POST /api/credits/deduct-external
 * External API to deduct credits from a user's balance
 * 
 * Requires HMAC authentication via X-HMAC-Signature header
 * 
 * Body:
 * {
 *   "userEmail": "user@example.com",  // Optional: user email
 *   "userId": "user_xxx",              // Optional: Clerk user ID
 *   "amount": 10,                       // Required: credits to deduct
 *   "reason": "Content creation",      // Optional: reason for deduction
 *   "idempotencyKey": "unique-key"     // Optional: prevents duplicate charges
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "newBalance": 90,
 *   "deducted": 10,
 *   "ledgerId": "ledger-entry-id",
 *   "userId": "user_xxx",
 *   "email": "user@example.com"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Validate HMAC signature
    const validation = await validateHMACRequest(req);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.error || 'Invalid HMAC signature',
          code: 'HMAC_VALIDATION_FAILED'
        },
        { status: 401 }
      );
    }

    const body = validation.body;
    const { userEmail, userId, amount, reason, idempotencyKey } = body;

    // Validate required fields
    if (!userEmail && !userId) {
      return NextResponse.json(
        { 
          error: 'Either userEmail or userId must be provided',
          code: 'MISSING_USER_IDENTIFIER'
        },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { 
          error: 'Amount must be a positive number',
          code: 'INVALID_AMOUNT'
        },
        { status: 400 }
      );
    }

    // Find user by email or use provided userId (clerkId)
    let clerkId: string | null = null;

    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { clerkId: true, email: true, isActive: true }
      });

      if (!user) {
        return NextResponse.json(
          { 
            error: `User not found with email: ${userEmail}`,
            code: 'USER_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { 
            error: 'User account is inactive',
            code: 'USER_INACTIVE'
          },
          { status: 403 }
        );
      }

      clerkId = user.clerkId;
    } else {
      // Validate that userId exists
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { clerkId: true, email: true, isActive: true }
      });

      if (!user) {
        return NextResponse.json(
          { 
            error: `User not found with userId: ${userId}`,
            code: 'USER_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { 
            error: 'User account is inactive',
            code: 'USER_INACTIVE'
          },
          { status: 403 }
        );
      }

      clerkId = userId;
    }

    if (!clerkId) {
      return NextResponse.json(
        { 
          error: 'Unable to resolve user identifier',
          code: 'USER_RESOLUTION_FAILED'
        },
        { status: 500 }
      );
    }

    // Deduct credits using existing function
    try {
      const result = await deductCredits(
        clerkId,
        amount,
        reason || 'External API credit deduction',
        idempotencyKey
      );

      if (!result || !result.success) {
        // Handle insufficient credits or duplicate transaction
        if (result?.message) {
          const statusCode = result.message.includes('Insufficient') ? 402 : 
                            result.message.includes('already processed') ? 409 : 400;
          
          return NextResponse.json(
            { 
              error: result.message,
              code: result.message.includes('Insufficient') ? 'INSUFFICIENT_CREDITS' :
                    result.message.includes('already processed') ? 'DUPLICATE_TRANSACTION' : 'DEDUCTION_FAILED',
              ledgerId: result.ledgerId || null
            },
            { status: statusCode }
          );
        }

        return NextResponse.json(
          { 
            error: 'Failed to deduct credits',
            code: 'DEDUCTION_FAILED'
          },
          { status: 500 }
        );
      }

      // Get user email for response
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { email: true }
      });

      return NextResponse.json({
        success: true,
        newBalance: result.updatedUser.creditBalance,
        deducted: amount,
        ledgerId: result.ledgerEntry.id,
        userId: clerkId,
        email: user?.email || userEmail || null,
        timestamp: new Date().toISOString()
      });
    } catch (deductError: any) {
      // Handle errors from deductCredits function
      const errorMessage = deductError?.message || 'Failed to deduct credits';
      
      if (errorMessage.includes('Insufficient')) {
        return NextResponse.json(
          { 
            error: errorMessage,
            code: 'INSUFFICIENT_CREDITS'
          },
          { status: 402 }
        );
      }
      
      if (errorMessage.includes('User not found')) {
        return NextResponse.json(
          { 
            error: errorMessage,
            code: 'USER_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      // Re-throw to be caught by outer catch block
      throw deductError;
    }

  } catch (error: any) {
    console.error('[POST /api/credits/deduct-external] Error:', error);
    
    // Handle database errors
    if (error?.message?.includes('P1001') || error?.message?.includes("Can't reach database")) {
      return NextResponse.json(
        { 
          error: 'Database connection failed. Please try again later.',
          code: 'DATABASE_ERROR'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

