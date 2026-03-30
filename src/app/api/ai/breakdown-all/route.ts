import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiBreakdownScene } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";

/**
 * POST /api/ai/breakdown-all
 * Body: { projectId: string }
 *
 * Runs AI breakdown on ALL scenes in parallel batches of 3.
 * Streams progress via SSE so the frontend can show real-time updates.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { projectId } = await req.json();

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    include: { castLinks: { include: { castMember: true } } },
    orderBy: { order: "asc" },
  });

  if (scenes.length === 0) {
    return new Response(JSON.stringify({ error: "No scenes found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE stream for progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total: scenes.length });

      let totalAdded = 0;
      let processed = 0;
      const BATCH_SIZE = 3; // 3 parallel Ollama calls at a time

      // Process in batches
      for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (scene) => {
            try {
              const aiElements = await aiBreakdownScene({
                sceneNumber: scene.sceneNumber,
                sceneName: scene.sceneName,
                intExt: scene.intExt,
                dayNight: scene.dayNight,
                synopsis: scene.synopsis,
                content: scene.content,
              });

              let existing: Array<{ id?: string; name: string; category: string; source: string; status: string }> = [];
              if (scene.elementsJson) {
                try { existing = JSON.parse(scene.elementsJson); } catch { /* */ }
              }

              const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));
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

              if (newElements.length > 0) {
                const merged = [...existing, ...newElements];
                await prisma.scene.update({
                  where: { id: scene.id },
                  data: { elementsJson: JSON.stringify(merged) },
                });
              }

              return { sceneNumber: scene.sceneNumber, added: newElements.length };
            } catch {
              return { sceneNumber: scene.sceneNumber, added: 0, error: true };
            }
          })
        );

        // Send progress for each completed scene in this batch
        for (const result of results) {
          processed++;
          const value = result.status === "fulfilled" ? result.value : { sceneNumber: "?", added: 0, error: true };
          totalAdded += value.added;

          send({
            type: "progress",
            processed,
            total: scenes.length,
            scene: value.sceneNumber,
            added: value.added,
            totalAdded,
            error: "error" in value ? true : undefined,
          });
        }
      }

      // Final result
      send({
        type: "done",
        totalAdded,
        scenesProcessed: processed,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
