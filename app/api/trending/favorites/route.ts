import { NextRequest, NextResponse } from "next/server"
import { toggleFavoriteProduct } from "@/lib/actions/trending.actions"
import { auth } from "@clerk/nextjs"

export const dynamic = "force-dynamic"

// POST /api/trending/favorites
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          error: "Product ID is required",
        },
        { status: 400 }
      )
    }

    // Get user ID from database using Clerk ID
    const { getUserById } = await import("@/lib/actions/user.actions")
    const user = await getUserById(userId)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      )
    }

    const result = await toggleFavoriteProduct(user.id, productId)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("Error toggling favorite:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle favorite",
      },
      { status: 500 }
    )
  }
}

