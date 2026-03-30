import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiBreakdownScene } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";

/**
 * POST /api/ai/breakdown
 * Body: { sceneId: string, projectId: string }
 *
 * Runs AI breakdown on a single scene, merges results into elementsJson as "pending".
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, projectId } = await req.json();

    if (!sceneId || !projectId) {
      return NextResponse.json({ error: "sceneId and projectId required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, userId: true } });
    if (!project || (project.userId && project.userId !== user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: { castLinks: { include: { castMember: true } } },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Run AI extraction — now with full scene content
    const aiElements = await aiBreakdownScene({
      sceneNumber: scene.sceneNumber,
      sceneName: scene.sceneName,
      intExt: scene.intExt,
      dayNight: scene.dayNight,
      synopsis: scene.synopsis,
      content: scene.content,
    });

    // Parse existing elements
    let existing: Array<{ id?: string; name: string; category: string; source: string; status: string; confidence?: number }> = [];
    if (scene.elementsJson) {
      try { existing = JSON.parse(scene.elementsJson); } catch { /* */ }
    }

    // Deduplicate: skip AI elements whose name already exists (case-insensitive)
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
    // Also skip names that match cast links
    scene.castLinks.forEach((cl) => {
      existingNames.add((cl.castMember.characterName || cl.castMember.name).toLowerCase());
    });

    const newElements = aiElements
      .filter((el) => !existingNames.has(el.name.toLowerCase()))
      .map((el) => ({
        id: Math.random().toString(36).slice(2, 10),
        name: el.name,
        category: el.category,
        source: "ai",
        status: "pending",
        confidence: el.confidence,
      }));

    const merged = [...existing, ...newElements];

    // Save back
    await prisma.scene.update({
      where: { id: sceneId },
      data: { elementsJson: JSON.stringify(merged) },
    });

    return NextResponse.json({
      added: newElements.length,
      total: merged.length,
      elements: newElements,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI breakdown failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
