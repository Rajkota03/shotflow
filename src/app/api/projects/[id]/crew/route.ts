import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const crew = await prisma.crewMember.findMany({
    where: { projectId: id },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(crew);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const crew = await prisma.crewMember.create({
    data: {
      projectId: id,
      name: body.name,
      department: body.department || "production",
      role: body.role,
      dayRate: body.dayRate || 0,
      overtimeRate: body.overtimeRate || 0,
      contractedDays: body.contractedDays || 0,
      notes: body.notes,
    },
  });
  return NextResponse.json(crew, { status: 201 });
}
