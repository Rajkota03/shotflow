import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locations = await prisma.location.findMany({
    where: { projectId: id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(locations);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const location = await prisma.location.create({
    data: {
      projectId: id,
      name: body.name,
      address: body.address,
      locationType: body.locationType || "studio",
      dailyRentalCost: body.dailyRentalCost || 0,
      permitCost: body.permitCost || 0,
      travelDistanceKm: body.travelDistanceKm || 0,
      hasPower: body.hasPower ?? true,
      hasParking: body.hasParking ?? true,
      notes: body.notes,
    },
  });
  return NextResponse.json(location, { status: 201 });
}
