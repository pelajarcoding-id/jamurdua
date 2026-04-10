import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const deletedDetail = await prisma.detailGajian.deleteMany({})
  const deletedNota = await prisma.notaSawit.deleteMany({})
  const deletedTimbangan = await prisma.timbangan.deleteMany({})
  console.log(JSON.stringify({
    detailGajianDeleted: deletedDetail.count,
    notaSawitDeleted: deletedNota.count,
    timbanganDeleted: deletedTimbangan.count,
  }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
