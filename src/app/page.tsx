import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Landing } from "@/components/landing";

export default async function Page() {
  const user = await getSessionUser();

  if (user) {
    const latest = await prisma.project.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (latest) {
      redirect(`/projects/${latest.id}`);
    } else {
      redirect("/projects/new");
    }
  }

  return <Landing />;
}
