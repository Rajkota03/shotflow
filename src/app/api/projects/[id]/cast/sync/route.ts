import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// POST: Extract characters from existing scenes and create cast members
// This is a one-time sync for projects that were imported before the auto-cast feature
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!project || (project.userId && project.userId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Clear existing cast for re-sync
    await prisma.castSceneLink.deleteMany({
      where: { castMember: { projectId: id } },
    });
    await prisma.castMember.deleteMany({ where: { projectId: id } });

    // Get all scenes
    const scenes = await prisma.scene.findMany({
      where: { projectId: id },
      select: { id: true, sceneNumber: true, content: true, sceneName: true },
      orderBy: { order: "asc" },
    });

    if (scenes.length === 0) {
      return NextResponse.json({ error: "No scenes found" }, { status: 400 });
    }

    // Extract characters from each scene
    const charSceneMap = new Map<string, Set<string>>(); // character name -> set of scene IDs

    const IGNORE = new Set([
      "INT", "EXT", "CUT TO", "FADE IN", "FADE OUT", "DISSOLVE TO",
      "SMASH CUT", "CONTINUED", "MORE", "CONT", "THE END",
      "FLASHBACK", "MONTAGE", "SUPER", "TITLE", "CHYRON",
      "V.O", "O.S", "LATER", "ANGLE ON", "CLOSE UP", "WIDE SHOT",
      "END", "INTERCUT", "BACK TO", "JUMP CUT", "MATCH CUT",
      "SERIES OF SHOTS", "DREAM SEQUENCE", "DAY", "NIGHT",
      "MORNING", "EVENING", "CONTINUOUS", "SAME TIME",
      // Common Indian screenplay words that aren't characters
      "SCENE", "LOCATION", "TIME", "CHARACTERS",
    ]);

    for (const scene of scenes) {
      const content = scene.content || "";
      if (!content) continue;

      const sceneChars = new Set<string>();

      // Method 1: Indian format — "Characters – Name1, Name2"
      const indianMatch = content.match(/Characters?\s*[-–—:]\s*([^\n]+)/i);
      if (indianMatch) {
        const names = indianMatch[1].split(/[,&]|\band\b/i)
          .map((n) => n.trim())
          .filter((n) => n.length > 1 && n.length < 30);
        for (const name of names) {
          const cleaned = name.replace(/^and\s+/i, "").replace(/Time.*$/i, "").trim();
          if (cleaned && !IGNORE.has(cleaned.toUpperCase())) {
            sceneChars.add(cleaned);
          }
        }
      }

      // Method 2: Dialogue pattern — name on its own line followed by dialogue or (parenthetical)
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Character name rules:
        // - 2-20 chars, 1-2 words max
        // - Starts with capital letter
        // - No punctuation (periods, commas, semicolons, exclamation, question marks, ellipsis)
        // - Not a sentence (no spaces after 3 words)
        const wordCount = line.split(/\s+/).length;
        if (
          line.length >= 2 &&
          line.length <= 20 &&
          wordCount <= 2 &&
          /^[A-Z][a-zA-Z]*$/.test(line.split(/\s+/)[0]) && // first word starts caps
          !/[.,;!?…–—:'"()]/.test(line) && // no punctuation at all
          !/\d/.test(line) // no numbers
        ) {
          // Check next line exists and looks like dialogue or parenthetical
          const nextLine = lines[i + 1]?.trim() || "";
          if (
            nextLine.startsWith("(") || // parenthetical like (Call lo)
            (nextLine.length > 5 && nextLine.length < 200) // dialogue
          ) {
            const name = line.replace(/\s*\(.*\)$/, "").trim();
            if (
              name.length >= 2 &&
              name.length <= 20 &&
              !IGNORE.has(name.toUpperCase()) &&
              // Filter out common English words that aren't character names
              !/^(Then|But|And|The|She|He|They|We|It|Is|Was|Has|Had|Will|Can|Do|Did|Not|From|With|For|Into|Over|This|That|What|When|Where|How|Why|Just|Also|Like|Here|There|After|Before|While|About|Some|Very|Just|Only|Even|Still|Already|Next|Last|Again|Both|Each|Every|Few|Many|More|Much|Other|Such|Than|Too|Call|Yeah|Yes|No|Ok|Hey|Btw|Nice|Bike|Room|Flat|Road|Door|Phone|Okay|Wait|Hello|Thank you|Good night|Good morning|Song Starts|Song Ends|Song starts|Song ends|Continuation|BGV|juniors|2 couples|Paani|Women)$/i.test(name) &&
              // Filter out Telugu/Hindi action words that got misidentified
              !/\b(alochisthu|kopanga|kurchuntu|matladadu)\b/i.test(name)
            ) {
              sceneChars.add(name);
            }
          }
        }
      }

      // Add to map
      for (const charName of sceneChars) {
        if (!charSceneMap.has(charName)) {
          charSceneMap.set(charName, new Set());
        }
        charSceneMap.get(charName)!.add(scene.id);
      }
    }

    // Merge case variants (e.g. "DIvya" → "Divya", "SuryaPrakash" → "Surya Prakash")
    const normalizedMap = new Map<string, { canonical: string; sceneIds: Set<string> }>();
    for (const [charName, sceneIds] of charSceneMap) {
      const key = charName.toLowerCase().replace(/\s+/g, "");
      if (normalizedMap.has(key)) {
        const existing = normalizedMap.get(key)!;
        for (const sid of sceneIds) existing.sceneIds.add(sid);
      } else {
        normalizedMap.set(key, { canonical: charName, sceneIds: new Set(sceneIds) });
      }
    }

    // Replace charSceneMap with merged version
    charSceneMap.clear();
    for (const { canonical, sceneIds } of normalizedMap.values()) {
      charSceneMap.set(canonical, sceneIds);
    }

    // Auto-categorize and create cast
    const totalScenes = scenes.length;
    const created: { characterName: string; roleType: string; sceneCount: number }[] = [];

    for (const [charName, sceneIds] of charSceneMap) {
      const sceneCount = sceneIds.size;
      const ratio = totalScenes > 0 ? sceneCount / totalScenes : 0;

      // Role categorization: use both ratio and absolute scene count
      let roleType = "day_player";
      if (ratio >= 0.3 || sceneCount >= 40) roleType = "lead";
      else if (ratio >= 0.08 || sceneCount >= 10) roleType = "supporting";
      else if (sceneCount >= 3) roleType = "day_player";
      else roleType = "extra";

      const member = await prisma.castMember.create({
        data: {
          projectId: id,
          name: "",
          characterName: charName,
          roleType,
          dayRate: 0,
        },
      });

      // Create scene links
      if (sceneIds.size > 0) {
        await prisma.castSceneLink.createMany({
          data: Array.from(sceneIds).map((sceneId) => ({
            castId: member.id,
            sceneId,
          })),
        });
      }

      created.push({ characterName: charName, roleType, sceneCount });
    }

    // Sort by scene count descending
    created.sort((a, b) => b.sceneCount - a.sceneCount);

    // ── Auto-populate locations from scene headings ──
    const existingLocations = await prisma.location.count({ where: { projectId: id } });
    let locationsCreated = 0;

    if (existingLocations === 0) {
      // Extract unique locations from scene names
      const locationMap = new Map<string, number>(); // name → scene count
      for (const scene of scenes) {
        const name = scene.sceneName?.trim();
        if (!name || name === "UNNAMED SCENE") continue;
        locationMap.set(name, (locationMap.get(name) || 0) + 1);
      }

      // Create location records
      for (const [name, count] of locationMap) {
        // Infer location type from name
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
      message: `Created ${created.length} cast members and ${locationsCreated} locations from ${scenes.length} scenes`,
      cast: created,
      locationsCreated,
    });
  } catch (err) {
    console.error("Cast sync error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
