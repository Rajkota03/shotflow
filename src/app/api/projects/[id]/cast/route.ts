import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cast = await prisma.castMember.findMany({
    where: { projectId: id },
    orderBy: { name: "asc" },
    include: {
      sceneLinks: { include: { scene: true } },
    },
  });
  return NextResponse.json(cast);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const cast = await prisma.castMember.create({
    data: {
      projectId: id,
      name: body.name,
      characterName: body.characterName,
      roleType: body.roleType || "lead",
      paymentMode: body.paymentMode === "package" ? "package" : "per_day",
      dayRate: body.dayRate || 0,
      packageFee: body.packageFee || 0,
      travelRequired: body.travelRequired || false,
      availableDates: body.availableDates || null,
      notes: body.notes,
    },
  });
  return NextResponse.json(cast, { status: 201 });
}
