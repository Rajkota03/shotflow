import { NextResponse } from "next/server";
import { ollamaHealth, getActiveProvider } from "@/lib/ai";

/**
 * GET /api/ai/health
 * Check which AI provider is active (anthropic or ollama) and if it's reachable.
 */
export async function GET() {
  const provider = getActiveProvider();
  const health = await ollamaHealth();
  return NextResponse.json({ ...health, provider });
}
