import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; locationId: string }> }) {
  const { locationId } = await params;
  const body = await req.json();
  const location = await prisma.location.update({
    where: { id: locationId },
    data: {
      name: body.name,
      address: body.address,
      locationType: body.locationType,
      dailyRentalCost: body.dailyRentalCost,
      permitCost: body.permitCost,
      travelDistanceKm: body.travelDistanceKm,
      hasPower: body.hasPower,
      hasParking: body.hasParking,
      notes: body.notes,
    },
  });
  return NextResponse.json(location);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; locationId: string }> }) {
  const { locationId } = await params;
  await prisma.location.delete({ where: { id: locationId } });
  return NextResponse.json({ success: true });
}
