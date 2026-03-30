import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logBudgetChange } from "@/lib/budget-engine";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sceneId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: {
      castLinks: { include: { castMember: true } },
      shots: { orderBy: { order: "asc" } },
    },
  });
  if (!scene) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(scene);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sceneId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  const prev = await prisma.scene.findUnique({ where: { id: sceneId } });

  const scene = await prisma.scene.update({
    where: { id: sceneId },
    data: {
      sceneNumber: body.sceneNumber,
      sceneName: body.sceneName,
      intExt: body.intExt,
      dayNight: body.dayNight,
      pageCount: body.pageCount,
      synopsis: body.synopsis,
      scriptPageRef: body.scriptPageRef,
      shootDayId: body.shootDayId !== undefined ? body.shootDayId : undefined,
      status: body.status,
      order: body.order !== undefined ? body.order : undefined,
      elementsJson: body.elementsJson !== undefined ? body.elementsJson : undefined,
    },
    include: {
      castLinks: { include: { castMember: true } },
      shots: true,
    },
  });

  // Log if shoot day changed
  if (prev && body.shootDayId !== undefined && prev.shootDayId !== body.shootDayId) {
    const description = body.shootDayId
      ? `Scene ${scene.sceneNumber} moved to shoot day`
      : `Scene ${scene.sceneNumber} unscheduled`;
    await logBudgetChange(id, "scene_moved", description, 0, "scene", sceneId);
  }

  return NextResponse.json(scene);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sceneId } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.scene.delete({ where: { id: sceneId } });
  return NextResponse.json({ success: true });
}
