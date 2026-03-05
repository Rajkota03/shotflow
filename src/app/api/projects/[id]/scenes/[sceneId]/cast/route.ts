import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logBudgetChange } from "@/lib/budget-engine";

// POST: add cast to scene, DELETE body: remove cast from scene
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const { id, sceneId } = await params;
  const body = await req.json();
  const { castId } = body;

  const cast = await prisma.castMember.findUnique({ where: { id: castId } });
  if (!cast) return NextResponse.json({ error: "Cast not found" }, { status: 404 });

  const link = await prisma.castSceneLink.upsert({
    where: { castId_sceneId: { castId, sceneId } },
    create: { castId, sceneId },
    update: {},
  });

  await logBudgetChange(
    id,
    "cast_added",
    `${cast.name} added to scene`,
    cast.dayRate,
    "cast",
    castId
  );

  return NextResponse.json(link, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const { id, sceneId } = await params;
  const { castId } = await req.json();

  const cast = await prisma.castMember.findUnique({ where: { id: castId } });

  await prisma.castSceneLink.deleteMany({ where: { castId, sceneId } });

  if (cast) {
    await logBudgetChange(
      id,
      "cast_removed",
      `${cast.name} removed from scene`,
      -cast.dayRate,
      "cast",
      castId
    );
  }

  return NextResponse.json({ success: true });
}
