import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ProfileView from '@/components/profile/profile-view';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

export default async function ProfilePage() {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    redirect('/auth/login');
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail as string },
  });

  if (!user) {
    redirect('/auth/login');
  }

  const role = (user as any)?.role as string | undefined
  const kebunId = (user as any)?.kebunId as number | null | undefined
  const userId = Number((user as any)?.id)

  let kebunIds: number[] = []
  if (role === 'MANDOR' && typeof kebunId === 'number') {
    kebunIds = [kebunId]
  } else if (role === 'MANAGER' && Number.isFinite(userId)) {
    try {
      const rows = await prisma.$queryRaw<Array<{ id: number }>>(
        Prisma.sql`SELECT "A" as id FROM "_UserKebuns" WHERE "B" = ${userId}`
      )
      kebunIds = rows.map(r => r.id)
    } catch {
      kebunIds = []
    }
  }

  const kebunTerikat = kebunIds.length
    ? await prisma.kebun.findMany({ where: { id: { in: kebunIds } }, select: { id: true, name: true } })
    : []

  const ProfileViewAny = ProfileView as any
  return <ProfileViewAny user={user as any} kebunTerikat={kebunTerikat} />;
}
