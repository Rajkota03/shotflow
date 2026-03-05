import { NextRequest, NextResponse } from "next/server";
import { calculateProjectBudget } from "@/lib/budget-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const budget = await calculateProjectBudget(id);
  return NextResponse.json(budget);
}
