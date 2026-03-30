import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiGenerateSynopsis } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";

/**
 * POST /api/ai/synopsis
 * Body: { sceneId: string }
 *
 * Generates an AI synopsis for a scene and saves it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId } = await req.json();

    if (!sceneId) {
      return NextResponse.json({ error: "sceneId required" }, { status: 400 });
    }

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Verify ownership via the scene's project
    const project = await prisma.project.findUnique({ where: { id: scene.projectId }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Gather existing elements for context
    let elementNames: string[] = [];
    if (scene.elementsJson) {
      try {
        const parsed = JSON.parse(scene.elementsJson);
        elementNames = parsed.map((e: { name: string }) => e.name);
      } catch { /* */ }
    }

    const synopsis = await aiGenerateSynopsis({
      sceneNumber: scene.sceneNumber,
      sceneName: scene.sceneName,
      intExt: scene.intExt,
      dayNight: scene.dayNight,
      content: scene.content,
      elements: elementNames,
    });

    // Save synopsis
    await prisma.scene.update({
      where: { id: sceneId },
      data: { synopsis: synopsis.trim() },
    });

    return NextResponse.json({ synopsis: synopsis.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Synopsis generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
