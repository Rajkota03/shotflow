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
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.department !== undefined) data.department = body.department;
  if (body.role !== undefined) data.role = body.role;
  if (body.paymentMode !== undefined) data.paymentMode = body.paymentMode === "package" ? "package" : "per_day";
  if (body.dayRate !== undefined) data.dayRate = body.dayRate;
  if (body.packageFee !== undefined) data.packageFee = body.packageFee;
  if (body.overtimeRate !== undefined) data.overtimeRate = body.overtimeRate;
  if (body.contractedDays !== undefined) data.contractedDays = body.contractedDays;
  if (body.notes !== undefined) data.notes = body.notes;
  const crew = await prisma.crewMember.update({ where: { id: crewId }, data });
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
