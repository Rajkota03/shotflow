import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface IncomingItem {
  id?: string;
  name: string;
  rate: number;
  quantity: number;
  rateType: "daily" | "weekly" | "flat";
  subcategory?: string | null;
}

interface IncomingCategory {
  id?: string;
  key: string;
  label: string;
  icon?: string | null;
  collapsed?: boolean;
  items: IncomingItem[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const categories = await prisma.budgetPlanCategory.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(categories);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as { categories: IncomingCategory[] };
  if (!Array.isArray(body?.categories)) {
    return NextResponse.json({ error: "categories array required" }, { status: 400 });
  }

  // Full replace transaction: wipe + insert. Simple and correct — caller sends
  // the full canonical tree each time.
  const result = await prisma.$transaction(async (tx) => {
    await tx.budgetPlanCategory.deleteMany({ where: { projectId: id } });
    const created = [];
    for (let ci = 0; ci < body.categories.length; ci++) {
      const c = body.categories[ci];
      const cat = await tx.budgetPlanCategory.create({
        data: {
          projectId: id,
          key: c.key,
          label: c.label,
          icon: c.icon ?? null,
          collapsed: !!c.collapsed,
          order: ci,
          items: {
            create: (c.items || []).map((it, ii) => ({
              name: it.name,
              rate: Number(it.rate) || 0,
              quantity: Number(it.quantity) || 0,
              rateType: it.rateType === "weekly" || it.rateType === "flat" ? it.rateType : "daily",
              subcategory: it.subcategory ?? null,
              order: ii,
            })),
          },
        },
        include: { items: { orderBy: { order: "asc" } } },
      });
      created.push(cat);
    }
    return created;
  });

  return NextResponse.json(result);
}
