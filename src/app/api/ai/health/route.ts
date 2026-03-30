import { NextResponse } from "next/server";
import { ollamaHealth } from "@/lib/ai";

/**
 * GET /api/ai/health
 * Check if Ollama is reachable and model is loaded.
 */
export async function GET() {
  const health = await ollamaHealth();
  return NextResponse.json(health);
}
