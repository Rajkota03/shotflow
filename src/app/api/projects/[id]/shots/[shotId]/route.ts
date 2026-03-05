import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; shotId: string }> }) {
  const { shotId } = await params;
  const body = await req.json();
  const shot = await prisma.shot.update({
    where: { id: shotId },
    data: {
      shotNumber: body.shotNumber,
      shotType: body.shotType,
      cameraAngle: body.cameraAngle,
      lensMm: body.lensMm,
      cameraMovement: body.cameraMovement,
      durationSeconds: body.durationSeconds,
      description: body.description,
      dialogueRef: body.dialogueRef,
      setupTimeMinutes: body.setupTimeMinutes,
      isVfx: body.isVfx,
      storyboardUrl: body.storyboardUrl,
      order: body.order !== undefined ? body.order : undefined,
    },
  });
  return NextResponse.json(shot);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; shotId: string }> }) {
  const { shotId } = await params;
  await prisma.shot.delete({ where: { id: shotId } });
  return NextResponse.json({ success: true });
}
