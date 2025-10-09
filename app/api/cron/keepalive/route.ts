import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    // Simple database ping to keep connection alive
    await prisma.$queryRaw`SELECT 1`;
    
    console.log(`[${new Date().toISOString()}] Database keep-alive successful`);
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      message: "Database keep-alive successful"
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Database keep-alive failed:`, error);
    
    return NextResponse.json({ 
      success: false, 
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  // Allow both GET and POST for flexibility
  return GET();
}
