import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, equipmentId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const equipment = await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      name: body.name,
      category: body.category,
      dailyRental: body.dailyRental,
      vendor: body.vendor,
      quantityAvailable: body.quantityAvailable,
      notes: body.notes,
    },
  });
  return NextResponse.json(equipment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; equipmentId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, equipmentId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.equipment.delete({ where: { id: equipmentId } });
  return NextResponse.json({ success: true });
}
