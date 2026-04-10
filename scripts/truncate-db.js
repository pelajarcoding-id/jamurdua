const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const run = async () => {
  if (String(process.env.CONFIRM_TRUNCATE || '').toLowerCase() !== 'yes') {
    console.log('Refusing to truncate DB. Set CONFIRM_TRUNCATE=yes to proceed.')
    return
  }

  const tables = await prisma.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  )
  const exclude = new Set(['_prisma_migrations'])
  if (String(process.env.KEEP_USERS || '') === '1') exclude.add('User')
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
