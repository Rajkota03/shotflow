import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; castId: string }> }) {
  const { castId } = await params;
  const body = await req.json();
  const cast = await prisma.castMember.update({
    where: { id: castId },
    data: {
      name: body.name,
      characterName: body.characterName,
      roleType: body.roleType,
      dayRate: body.dayRate,
      travelRequired: body.travelRequired,
      notes: body.notes,
    },
  });
  return NextResponse.json(cast);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; castId: string }> }) {
  const { castId } = await params;
  await prisma.castMember.delete({ where: { id: castId } });
  return NextResponse.json({ success: true });
}
