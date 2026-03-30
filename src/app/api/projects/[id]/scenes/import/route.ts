import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Shape sent by the frontend script page
interface FrontendScene {
  sceneNumber: string;
  heading: string;
  intExt: string;
  dayNight: string;
  pageCount: number;
  content: string;
  characters?: string[]; // characters in this scene
}

// POST: Bulk import scenes from parsed script
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { scenes, characters } = await req.json();

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    // Delete existing scenes, cast members, and links for this project (re-import replaces)
    await prisma.castSceneLink.deleteMany({
      where: { castMember: { projectId: id } },
    });
    await prisma.castMember.deleteMany({ where: { projectId: id } });
    await prisma.scene.deleteMany({ where: { projectId: id } });

    // Insert scenes
    const sceneData = scenes.map((raw: FrontendScene, i: number) => ({
      projectId: id,
      sceneNumber: raw.sceneNumber || String(i + 1),
      sceneName: raw.heading || "UNNAMED SCENE",
      intExt: raw.intExt || "INT",
      dayNight: raw.dayNight || "DAY",
      pageCount: raw.pageCount || 1,
      synopsis: raw.content ? raw.content.trim().substring(0, 200) : null,
      content: raw.content ? raw.content.trim() : null,
      order: i,
      status: "unscheduled",
      elementsJson: "[]",
    }));

    await prisma.scene.createMany({ data: sceneData });

    // Fetch inserted scenes to get their IDs
    const insertedScenes = await prisma.scene.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
      select: { id: true, sceneNumber: true },
    });

    // Build character → scene mapping from scene-level data
    const charSceneMap = new Map<string, Set<string>>();
    const allCharacters: string[] = Array.isArray(characters) ? characters : [];

    for (let i = 0; i < scenes.length; i++) {
      const raw = scenes[i] as FrontendScene;
      const sceneId = insertedScenes[i]?.id;
      if (!sceneId) continue;

      const sceneChars = raw.characters || [];
      for (const charName of sceneChars) {
        const normalized = charName.trim();
        if (!normalized) continue;
        if (!charSceneMap.has(normalized)) {
          charSceneMap.set(normalized, new Set());
        }
        charSceneMap.get(normalized)!.add(sceneId);
        // Also ensure they're in the global list
        if (!allCharacters.includes(normalized)) {
          allCharacters.push(normalized);
        }
      }
    }

    // Add any global characters not found in scene-level data
    for (const ch of allCharacters) {
      if (!charSceneMap.has(ch)) {
        charSceneMap.set(ch, new Set());
      }
    }

    // Auto-categorize roles based on scene count
    const totalScenes = scenes.length;
    const castCreated: { name: string; id: string; sceneCount: number }[] = [];

    for (const [charName, sceneIds] of charSceneMap) {
      const sceneCount = sceneIds.size;
      const sceneRatio = totalScenes > 0 ? sceneCount / totalScenes : 0;

      // Lead: 40%+ scenes, Supporting: 15-40%, Day Player: <15%
      let roleType = "day_player";
      if (sceneRatio >= 0.4) roleType = "lead";
      else if (sceneRatio >= 0.15) roleType = "supporting";

      const member = await prisma.castMember.create({
        data: {
          projectId: id,
          name: "", // Actor name — user fills this in
          characterName: charName,
          roleType,
          dayRate: 0,
        },
      });

      castCreated.push({ name: charName, id: member.id, sceneCount });

      // Create scene links
      if (sceneIds.size > 0) {
        await prisma.castSceneLink.createMany({
          data: Array.from(sceneIds).map((sceneId) => ({
            castId: member.id,
            sceneId,
          })),
        });
      }
    }

    // ── Auto-populate locations from scene headings ──
    const existingLocations = await prisma.location.count({ where: { projectId: id } });
    let locationsCreated = 0;

    if (existingLocations === 0) {
      const locationMap = new Map<string, number>();
      for (const raw of scenes as FrontendScene[]) {
        const name = raw.heading?.trim();
        if (!name || name === "UNNAMED SCENE") continue;
        locationMap.set(name, (locationMap.get(name) || 0) + 1);
      }

      for (const [name] of locationMap) {
        const nameLower = name.toLowerCase();
        const isOutdoor = /\b(road|street|highway|garden|park|beach|river|mountain|market|outside|rooftop|terrace|field|ground|jungle|forest|parking|gate|bus|train|station)\b/.test(nameLower);
        const isStudio = /\b(studio|set|stage|green\s?screen)\b/.test(nameLower);

        await prisma.location.create({
          data: {
            projectId: id,
            name,
            locationType: isStudio ? "studio" : isOutdoor ? "outdoor" : "practical",
            dailyRentalCost: 0,
            permitCost: 0,
          },
        });
        locationsCreated++;
      }
    }

    return NextResponse.json({
      imported: insertedScenes.length,
      castCreated: castCreated.length,
      locationsCreated,
      cast: castCreated,
    });
  } catch (err) {
    console.error("Scene import error:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
