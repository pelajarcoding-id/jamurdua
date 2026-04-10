const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const run = async () => {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  )
  const exclude = new Set(['User', '_prisma_migrations'])
  const toTruncate = tables.map(t => t.tablename).filter(t => !exclude.has(t))
  if (toTruncate.length === 0) {
    console.log('No tables to truncate')
    return
  }
  const quoted = toTruncate.map(t => `"${t}"`).join(',')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE;`)
  console.log('Truncated:', toTruncate.join(', '))
}

run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
