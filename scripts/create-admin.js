const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const run = async () => {
  const email = 'admin@gmail.com'
  const password = 'admin123'
  const hash = await bcrypt.hash(password, 10)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name: 'Admin', role: 'ADMIN', passwordHash: hash },
    })
    console.log('Updated existing user:', email)
    return
  }
  await prisma.user.create({
    data: { name: 'Admin', email, role: 'ADMIN', passwordHash: hash },
  })
  console.log('Created user:', email)
}

run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
