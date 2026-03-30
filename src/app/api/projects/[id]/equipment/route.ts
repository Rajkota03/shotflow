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
  const equipment = await prisma.equipment.findMany({
    where: { projectId: id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      dayLinks: { include: { shootDay: true } },
    },
  });
  return NextResponse.json(equipment);
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
  const equipment = await prisma.equipment.create({
    data: {
      projectId: id,
      name: body.name,
      category: body.category || "camera",
      dailyRental: body.dailyRental || 0,
      vendor: body.vendor,
      quantityAvailable: body.quantityAvailable || 1,
      notes: body.notes,
    },
  });
  return NextResponse.json(equipment, { status: 201 });
}
