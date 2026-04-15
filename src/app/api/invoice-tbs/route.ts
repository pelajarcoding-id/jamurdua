export const dynamic = 'force-dynamic'

 import { NextResponse } from 'next/server'
 import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { requireAuth, requireRole } from '@/lib/route-auth'
 
 const roman = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
 
 function generateNumber(pabrikName: string, year: number, month: number, index: number) {
   const initials = (pabrikName || 'SJ').split(' ').map(s => s[0]).join('').toUpperCase()
   const romanMonth = roman[month] || 'I'
   const seq = String(index).padStart(2, '0')
   return `${seq}/INV-${initials}/${romanMonth}/${year}`
 }
 
async function ensureInvoiceColumns() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "InvoiceTbs" ADD COLUMN IF NOT EXISTS "detailMode" TEXT`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "InvoiceTbs" ADD COLUMN IF NOT EXISTS "signedPdfUrl" TEXT`);
  } catch {}
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "InvoiceTbs" ADD COLUMN IF NOT EXISTS "tanggalSurat" DATE`);
  } catch {}
}

 export async function GET(request: Request) {
   try {
    const guard = await requireAuth()
    if (guard.response) return guard.response
    await ensureInvoiceColumns()
     const url = new URL(request.url)
     const pabrikId = url.searchParams.get('pabrikId')
    const perusahaanId = url.searchParams.get('perusahaanId')
     const year = url.searchParams.get('year')
     const month = url.searchParams.get('month')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const search = url.searchParams.get('search') || ''
     const page = Number(url.searchParams.get('page') || 1)
     const limit = Number(url.searchParams.get('limit') || 20)
     const skip = (page - 1) * limit
 
     const where: any = {}
     if (pabrikId) where.pabrikId = Number(pabrikId)
    if (perusahaanId) where.perusahaanId = Number(perusahaanId)
     if (year) where.year = Number(year)
     if (month) where.month = Number(month)
    if (search.trim()) {
      const s = search.trim()
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { status: { contains: s, mode: 'insensitive' } },
        { pabrik: { name: { contains: s, mode: 'insensitive' } } },
      ]
    }
    if (startDate || endDate) {
      const and: any[] = Array.isArray(where.AND) ? where.AND : []
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null

      if (start) {
        const startYear = start.getFullYear()
        const startMonth = start.getMonth() + 1
        and.push({
          OR: [
            { year: { gt: startYear } },
            { AND: [{ year: startYear }, { month: { gte: startMonth } }] },
          ],
        })
      }

      if (end) {
        const endYear = end.getFullYear()
        const endMonth = end.getMonth() + 1
        and.push({
          OR: [
            { year: { lt: endYear } },
            { AND: [{ year: endYear }, { month: { lte: endMonth } }] },
          ],
        })
      }

      if (and.length > 0) where.AND = and
    }
 
    const [data, total] = await Promise.all([
      prisma.invoiceTbs.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { id: 'desc' }],
        include: { pabrik: true },
      }),
      prisma.invoiceTbs.count({ where }),
    ])
     return NextResponse.json({ data, total, page, limit })
   } catch (error) {
     console.error('GET /api/invoice-tbs error:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
   }
 }
 
 export async function POST(request: Request) {
   try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
    await ensureInvoiceColumns()
     const body = await request.json()
     const {
      pabrikId,
      perusahaanId,
      year,
      month,
      status = 'DRAFT',
      perihal,
      letterName,
      letterAddress,
      letterEmail,
      letterLogoUrl,
      tujuan,
      lokasiTujuan,
      ppnPct = 10,
      pph22Pct = 0.25,
      bankInfo,
      penandatangan,
      jabatanTtd,
      detailMode,
      signedPdfUrl,
      rows = [],
      number, // optional: if provided use as-is
      tanggalSurat,
    } = body || {}
 
     if (!pabrikId || !year || !month) {
      return NextResponse.json({ error: 'pabrikId, year, month wajib diisi' }, { status: 400 })
    }

    let pName = letterName;
    let pAddress = letterAddress;
    let pEmail = letterEmail;
    let pLogo = letterLogoUrl;

    if (perusahaanId) {
      const p = await (prisma as any).perusahaan.findUnique({ where: { id: Number(perusahaanId) } });
      if (p) {
        pName = pName || p.name;
        pAddress = pAddress || p.address;
        pEmail = pEmail || p.email;
        pLogo = pLogo || p.logoUrl;
      }
    }

    const pabrik = await prisma.pabrikSawit.findUnique({ where: { id: Number(pabrikId) } })
     if (!pabrik) {
       return NextResponse.json({ error: 'Pabrik tidak ditemukan' }, { status: 404 })
     }
 
     const totalKg = rows.reduce((acc: number, r: any) => acc + Number(r.jumlahKg || 0), 0)
     const totalRp = rows.reduce((acc: number, r: any) => acc + Number(r.jumlahRp || 0), 0)
     const totalPpn = Math.round((Number(ppnPct) / 100) * totalRp)
     const totalPph22 = Math.round((Number(pph22Pct) / 100) * totalRp)
     const grandTotal = totalRp + totalPpn - totalPph22
 
     let invoiceNumber = number
     if (!invoiceNumber) {
       // Cek apakah sudah ada invoice untuk pabrik, tahun, dan bulan ini
       const existing = await prisma.invoiceTbs.findFirst({
         where: { pabrikId: Number(pabrikId), year: Number(year), month: Number(month) }
       })
       if (existing) {
         invoiceNumber = existing.number
       } else {
         const count = await prisma.invoiceTbs.count({ where: { pabrikId: Number(pabrikId), year: Number(year), month: Number(month) } })
         invoiceNumber = generateNumber(pabrik.name || 'SJ', Number(year), Number(month), count + 1)
       }
     }
 
    const baseData = {
        year: Number(year),
        month: Number(month),
        number: invoiceNumber,
        tanggalSurat: tanggalSurat ? new Date(tanggalSurat) : null,
        status: String(status),
        perihal: perihal ?? 'Permohonan Pembayaran',
        letterName: pName ?? 'CV. SARAKAN JAYA',
        letterAddress: pAddress ?? null,
        letterEmail: pEmail ?? null,
        letterLogoUrl: pLogo ?? null,
        tujuan: tujuan ?? null,
        lokasiTujuan: lokasiTujuan ?? null,
        ppnPct: Number(ppnPct),
        pph22Pct: Number(pph22Pct),
        bankInfo: bankInfo ?? null,
        penandatangan: penandatangan ?? null,
        jabatanTtd: jabatanTtd ?? null,
        detailMode: detailMode ?? null,
        signedPdfUrl: signedPdfUrl ?? null,
        totalKg,
        totalRp,
        totalPpn,
        totalPph22,
        grandTotal,
     }

     const itemsData = rows.map((r: any) => ({
       bulanLabel: String(r.bulan || ''),
       jumlahKg: Number(r.jumlahKg || 0),
       harga: Number(r.harga || 0),
       jumlahRp: Number(r.jumlahRp || 0),
       notaSawitId: r.notaSawitId ? Number(r.notaSawitId) : null,
     }))

     const existingInvoice = await prisma.invoiceTbs.findUnique({
       where: { number: invoiceNumber }
     })

     let result;
    const pabrikConnect = { connect: { id: Number(pabrikId) } }
    const perusahaanConnect = perusahaanId ? { connect: { id: Number(perusahaanId) } } : undefined

    const doUpdate = async () => prisma.invoiceTbs.update({
      where: { id: existingInvoice!.id },
      data: {
        ...baseData,
        pabrik: pabrikConnect,
        perusahaan: perusahaanConnect ?? { disconnect: true },
        items: {
          deleteMany: {},
          create: itemsData,
        },
        histories: {
          create: [{ action: status === 'FINALIZED' ? 'FINALIZE' : 'UPDATE', details: body }],
        },
      } as any,
      include: { items: true, pabrik: true },
    })
    const doCreate = async () => prisma.invoiceTbs.create({
      data: {
        ...baseData,
        pabrik: pabrikConnect,
        ...(perusahaanConnect ? { perusahaan: perusahaanConnect } : {}),
        items: {
          create: itemsData,
        },
        histories: {
          create: [{ action: 'CREATE', details: body }],
        },
      } as any,
      include: { items: true, pabrik: true },
    })

    try {
      result = await (existingInvoice ? doUpdate() : doCreate())
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (msg.includes('Unknown argument `detailMode`') || msg.includes('Unknown argument `signedPdfUrl`')) {
        delete (baseData as any).detailMode
        delete (baseData as any).signedPdfUrl
        result = await (existingInvoice ? doUpdate() : doCreate())
      } else {
        throw err
      }
    }

    await createAuditLog(
      guard.id,
      existingInvoice ? 'UPDATE' : 'CREATE',
      'InvoiceTbs',
      String(result.id),
      {
        number: result.number,
        status: result.status,
        year: result.year,
        month: result.month,
        pabrikId: Number(pabrikId),
        perusahaanId: perusahaanId ? Number(perusahaanId) : null,
        detailMode: (baseData as any).detailMode ?? null,
        hasSignedPdf: !!(baseData as any).signedPdfUrl,
        totalKg: result.totalKg,
        totalRp: result.totalRp,
        totalPpn: result.totalPpn,
        totalPph22: result.totalPph22,
        grandTotal: result.grandTotal,
      }
    )
 
     return NextResponse.json({ data: result }, { status: existingInvoice ? 200 : 201 })
   } catch (error) {
     console.error('POST /api/invoice-tbs error:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
   }
 }
