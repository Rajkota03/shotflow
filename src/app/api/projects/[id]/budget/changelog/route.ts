import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const logs = await prisma.budgetChangeLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(logs);
}
