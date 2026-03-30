/**
 * Ollama AI client for ShotFlow.
 * Reads OLLAMA_URL and OLLAMA_MODEL from env vars.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

/**
 * Send a prompt to Ollama and get a complete response (non-streaming).
 */
export async function ollamaGenerate(prompt: string, system?: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system: system || "",
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data: OllamaResponse = await res.json();
    return data.response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if Ollama is reachable and the model is available.
 */
export async function ollamaHealth(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, model: OLLAMA_MODEL, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    const found = models.some((n: string) => n.startsWith(OLLAMA_MODEL));
    return {
      ok: found,
      model: OLLAMA_MODEL,
      error: found ? undefined : `Model "${OLLAMA_MODEL}" not found. Available: ${models.join(", ")}`,
    };
  } catch {
    return { ok: false, model: OLLAMA_MODEL, error: `Cannot reach Ollama at ${OLLAMA_URL}` };
  }
}

/**
 * Extract breakdown elements from scene text using AI.
 * Now accepts full scene content for much better extraction from Indian/multilingual scripts.
 */
export async function aiBreakdownScene(scene: {
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  synopsis?: string | null;
  content?: string | null;
}): Promise<Array<{ name: string; category: string; confidence: number }>> {
  const system = `You are a professional script breakdown assistant for Indian film production.
You analyze screenplays written in English, Hindi, Telugu, Tamil, or transliterated Indian languages (Tenglish, Hinglish, etc.).

Your job: Extract ALL production elements from the scene text and categorize them.

Categories (use exactly these):
- cast: Named speaking characters (e.g., "Veer", "Ayesha", "Raghu")
- extras: Background actors, crowds, unnamed people
- props: Physical objects characters interact with (gun, mobile phone, food, documents, condom packet, etc.)
- wardrobe: Specific clothing/costume mentions (military dress, torn dress, etc.)
- vfx: Visual effects needed (gunshot effects, blood, flashback transitions, etc.)
- makeup: Specific makeup/prosthetics (wounds, tears, bruises, blood, aging, etc.)
- locations: Specific places mentioned (house, kitchen, bedroom, road, hospital, etc.)
- stunts: Action sequences, fights, falls, chases
- vehicles: Cars, bikes, ambulances (e.g., "Maruthi Suzuki Gypsy")
- equipment: Camera/production equipment implied (dolly for tracking shots, crane, etc.)

Rules:
1. Read the FULL scene text carefully — props, vehicles, wardrobe are described within action lines
2. For transliterated text (Telugu/Hindi written in English), understand the meaning: "gun theesi" = takes out gun, "car ekkaganey" = gets in car
3. Extract character names even if mixed with non-English text
4. Be thorough — list every prop, every vehicle, every wardrobe item mentioned
5. Return ONLY a valid JSON array. No markdown, no explanation, no text outside the array.
6. Each item: {"name": "string", "category": "string", "confidence": 0.0-1.0}`;

  // Build the prompt with as much content as possible
  const sceneText = scene.content || scene.synopsis || "No content available.";
  // Truncate to ~3000 chars to stay within model context but keep enough for good extraction
  const truncatedContent = sceneText.length > 3000
    ? sceneText.substring(0, 3000) + "\n... [truncated]"
    : sceneText;

  const prompt = `Break down this scene into production elements:

Scene ${scene.sceneNumber}: ${scene.intExt}. ${scene.sceneName} - ${scene.dayNight}

--- SCENE TEXT ---
${truncatedContent}
--- END ---

Extract ALL cast, extras, props, wardrobe, VFX, makeup, locations, stunts, vehicles, and equipment. Return JSON array only.`;

  const raw = await ollamaGenerate(prompt, system);

  // Extract JSON array from response (handle markdown wrapping)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item: { name?: string; category?: string; confidence?: number }) =>
          item.name && item.category
      )
      .map((item: { name: string; category: string; confidence?: number }) => ({
        name: item.name,
        category: item.category.toLowerCase(),
        confidence: Math.min(1, Math.max(0, item.confidence ?? 0.7)),
      }));
  } catch {
    return [];
  }
}

/**
 * Generate a synopsis for a scene using AI.
 */
export async function aiGenerateSynopsis(scene: {
  sceneNumber: string;
  sceneName: string;
  intExt: string;
  dayNight: string;
  content?: string | null;
  elements?: string[];
}): Promise<string> {
  const system = `You are a screenwriting assistant. Write concise, vivid scene synopses for production use.
Keep it to 2-3 sentences. Focus on action, mood, and key story beats.
You can understand transliterated Indian languages (Telugu, Hindi, Tamil in English script).`;

  const sceneText = scene.content
    ? scene.content.substring(0, 2000)
    : scene.elements?.length
      ? `Elements present: ${scene.elements.join(", ")}`
      : "";

  const prompt = `Write a brief synopsis for this scene:

Scene ${scene.sceneNumber}: ${scene.intExt}. ${scene.sceneName} - ${scene.dayNight}

${sceneText}

Write 2-3 sentences in English describing what happens in this scene.`;

  return ollamaGenerate(prompt, system);
}
