import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response("ok");
  } catch (e) {
    return new Response("down", { status: 503 });
  }
}


