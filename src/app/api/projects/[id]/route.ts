import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

async function verifyOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return !!project;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      shootDays: {
        orderBy: [{ dayNumber: "asc" }, { order: "asc" }],
        include: {
          location: true,
          scenes: {
            orderBy: { order: "asc" },
            include: {
              castLinks: { include: { castMember: true } },
              shots: { orderBy: { order: "asc" } },
            },
          },
          equipmentLinks: { include: { equipment: true } },
        },
      },
      castMembers: { orderBy: { name: "asc" } },
      locations: { orderBy: { name: "asc" } },
      crewMembers: { orderBy: { department: "asc" } },
      equipment: { orderBy: { name: "asc" } },
      scenes: {
        where: { shootDayId: null },
        orderBy: { order: "asc" },
        include: {
          castLinks: { include: { castMember: true } },
          shots: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership check — allow if no userId set (legacy) or matches
  if (user && project.userId && project.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (user && !(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.genre !== undefined) data.genre = body.genre || null;
  if (body.format !== undefined) data.format = body.format;
  if (body.budgetCap !== undefined) data.budgetCap = Number(body.budgetCap);
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.productionCompany !== undefined) data.productionCompany = body.productionCompany || null;
  if (body.timezone !== undefined) data.timezone = body.timezone;
  if (body.defaultCallTime !== undefined) data.defaultCallTime = body.defaultCallTime;
  if (body.defaultWrapTime !== undefined) data.defaultWrapTime = body.defaultWrapTime;
  if (body.overtimeThreshold !== undefined) data.overtimeThreshold = Number(body.overtimeThreshold);
  if (body.turnaroundHours !== undefined) data.turnaroundHours = Number(body.turnaroundHours);
  if (body.defaultEncoding !== undefined) data.defaultEncoding = body.defaultEncoding;
  if (body.parserPreference !== undefined) data.parserPreference = body.parserPreference;
  if (body.defaultExportFormat !== undefined) data.defaultExportFormat = body.defaultExportFormat;
  if (body.defaultPaperSize !== undefined) data.defaultPaperSize = body.defaultPaperSize;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

  const project = await prisma.project.update({
    where: { id },
    data,
  });
  return NextResponse.json(project);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (user && !(await verifyOwnership(id, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
