import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; crewId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, crewId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const crew = await prisma.crewMember.update({
    where: { id: crewId },
    data: {
      name: body.name,
      department: body.department,
      role: body.role,
      dayRate: body.dayRate,
      overtimeRate: body.overtimeRate,
      contractedDays: body.contractedDays,
      notes: body.notes,
    },
  });
  return NextResponse.json(crew);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; crewId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, crewId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.crewMember.delete({ where: { id: crewId } });
  return NextResponse.json({ success: true });
}
