import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const name = process.env.ADMIN_NAME || 'Admin'
  const plainPassword = process.env.ADMIN_PASSWORD || 'admin'
  const shouldUpdatePassword = !!process.env.ADMIN_PASSWORD

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: 'ADMIN',
      ...(shouldUpdatePassword ? { passwordHash, passwordChangedAt: new Date() } : {}),
    },
    create: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log({
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      password: plainPassword,
      passwordUpdated: shouldUpdatePassword || admin.createdAt.getTime() === admin.updatedAt.getTime(),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
