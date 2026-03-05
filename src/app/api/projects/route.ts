import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { scenes: true, shootDays: true },
      },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const project = await prisma.project.create({
    data: {
      title: body.title,
      genre: body.genre,
      format: body.format || "film",
      budgetCap: body.budgetCap || 0,
      currency: body.currency || "INR",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
