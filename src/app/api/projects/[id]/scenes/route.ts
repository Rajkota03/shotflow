import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logBudgetChange } from "@/lib/budget-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenes = await prisma.scene.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
    include: {
      castLinks: { include: { castMember: true } },
      shots: { orderBy: { order: "asc" } },
    },
  });
  return NextResponse.json(scenes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const maxOrder = await prisma.scene.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });

  const scene = await prisma.scene.create({
    data: {
      projectId: id,
      sceneNumber: body.sceneNumber,
      sceneName: body.sceneName,
      intExt: body.intExt || "INT",
      dayNight: body.dayNight || "DAY",
      pageCount: body.pageCount || 1,
      synopsis: body.synopsis,
      scriptPageRef: body.scriptPageRef,
      shootDayId: body.shootDayId || null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: {
      castLinks: { include: { castMember: true } },
      shots: true,
    },
  });

  if (body.shootDayId) {
    await logBudgetChange(id, "scene_added", `Scene ${body.sceneNumber} added to Day`, 0, "scene", scene.id);
  }

  return NextResponse.json(scene, { status: 201 });
}
