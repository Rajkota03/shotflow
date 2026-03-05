import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const sceneId = searchParams.get("sceneId");

  const shots = await prisma.shot.findMany({
    where: { projectId: id, ...(sceneId ? { sceneId } : {}) },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(shots);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const maxOrder = await prisma.shot.aggregate({
    where: { sceneId: body.sceneId },
    _max: { order: true },
  });

  const shot = await prisma.shot.create({
    data: {
      projectId: id,
      sceneId: body.sceneId,
      shotNumber: body.shotNumber,
      shotType: body.shotType || "Wide",
      cameraAngle: body.cameraAngle,
      lensMm: body.lensMm,
      cameraMovement: body.cameraMovement || "Static",
      durationSeconds: body.durationSeconds || 0,
      description: body.description,
      dialogueRef: body.dialogueRef,
      setupTimeMinutes: body.setupTimeMinutes || 15,
      isVfx: body.isVfx || false,
      storyboardUrl: body.storyboardUrl,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json(shot, { status: 201 });
}
