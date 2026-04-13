import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; castId: string }> }) {
  const { castId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.characterName !== undefined) data.characterName = body.characterName;
  if (body.roleType !== undefined) data.roleType = body.roleType;
  if (body.paymentMode !== undefined) data.paymentMode = body.paymentMode === "package" ? "package" : "per_day";
  if (body.dayRate !== undefined) data.dayRate = body.dayRate;
  if (body.packageFee !== undefined) data.packageFee = body.packageFee;
  if (body.travelRequired !== undefined) data.travelRequired = body.travelRequired;
  if (body.availableDates !== undefined) data.availableDates = body.availableDates;
  if (body.notes !== undefined) data.notes = body.notes;
  const cast = await prisma.castMember.update({ where: { id: castId }, data });
  return NextResponse.json(cast);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; castId: string }> }) {
  const { castId } = await params;
  await prisma.castMember.delete({ where: { id: castId } });
  return NextResponse.json({ success: true });
}
