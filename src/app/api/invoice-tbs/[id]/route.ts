export const dynamic = 'force-dynamic'

 import { NextResponse } from 'next/server'
 import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { requireAuth, requireRole } from '@/lib/route-auth'
 
 export async function GET(_: Request, { params }: { params: { id: string } }) {
   try {
    const guard = await requireAuth()
    if (guard.response) return guard.response
     const id = Number(params.id)
     const data = await prisma.invoiceTbs.findUnique({
       where: { id },
       include: { items: true, histories: true, pabrik: true },
     })
     if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
     return NextResponse.json({ data })
   } catch (error) {
     console.error('GET /api/invoice-tbs/[id] error:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
   }
 }
 
 export async function PUT(request: Request, { params }: { params: { id: string } }) {
   try {
    const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
    if (guard.response) return guard.response
     const id = Number(params.id)
     const body = await request.json()
     const {
       status,
       perihal,
       letterName,
       letterAddress,
       letterEmail,
       letterLogoUrl,
       tujuan,
       lokasiTujuan,
       ppnPct,
       pph22Pct,
       bankInfo,
       penandatangan,
       jabatanTtd,
      detailMode,
      signedPdfUrl,
       rows,
     } = body || {}
 
     const existing = await prisma.invoiceTbs.findUnique({ where: { id }, include: { items: true } })
     if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
 
     let totalKg = existing.totalKg
     let totalRp = existing.totalRp
     let totalPpn = existing.totalPpn
     let totalPph22 = existing.totalPph22
     let grandTotal = existing.grandTotal
 
     if (Array.isArray(rows)) {
       totalKg = rows.reduce((acc: number, r: any) => acc + Number(r.jumlahKg || 0), 0)
       totalRp = rows.reduce((acc: number, r: any) => acc + Number(r.jumlahRp || 0), 0)
       const ppnVal = typeof ppnPct === 'number' ? ppnPct : existing.ppnPct
       const pphVal = typeof pph22Pct === 'number' ? pph22Pct : existing.pph22Pct
       totalPpn = Math.round((Number(ppnVal) / 100) * totalRp)
       totalPph22 = Math.round((Number(pphVal) / 100) * totalRp)
       grandTotal = totalRp + totalPpn - totalPph22
     }
 
    const updated = await prisma.invoiceTbs.update({
       where: { id },
      data: {
         status: status ?? undefined,
         perihal: perihal ?? undefined,
         letterName: letterName ?? undefined,
         letterAddress: letterAddress ?? undefined,
         letterEmail: letterEmail ?? undefined,
         letterLogoUrl: letterLogoUrl ?? undefined,
         tujuan: tujuan ?? undefined,
         lokasiTujuan: lokasiTujuan ?? undefined,
         ppnPct: typeof ppnPct === 'number' ? ppnPct : undefined,
         pph22Pct: typeof pph22Pct === 'number' ? pph22Pct : undefined,
         bankInfo: bankInfo ?? undefined,
         penandatangan: penandatangan ?? undefined,
         jabatanTtd: jabatanTtd ?? undefined,
        detailMode: detailMode ?? undefined,
        signedPdfUrl: signedPdfUrl ?? undefined,
         totalKg,
         totalRp,
         totalPpn,
         totalPph22,
         grandTotal,
         items: Array.isArray(rows)
           ? {
               deleteMany: { invoiceId: id },
               create: rows.map((r: any) => ({
                 bulanLabel: String(r.bulan || ''),
                 jumlahKg: Number(r.jumlahKg || 0),
                 harga: Number(r.harga || 0),
                 jumlahRp: Number(r.jumlahRp || 0),
                 notaSawitId: r.notaSawitId ? Number(r.notaSawitId) : null,
               })),
             }
           : undefined,
         histories: { create: [{ action: status === 'FINALIZED' ? 'FINALIZE' : 'UPDATE', details: body }] },
      } as any,
       include: { items: true, histories: true, pabrik: true },
     })

    await createAuditLog(guard.id, 'UPDATE', 'InvoiceTbs', String(updated.id), {
      number: updated.number,
      statusFrom: existing.status,
      statusTo: updated.status,
      signedPdfUrlChanged: typeof signedPdfUrl === 'string' ? true : false,
      detailMode: typeof detailMode === 'string' ? detailMode : undefined,
      totals: {
        totalKg: updated.totalKg,
        totalRp: updated.totalRp,
        totalPpn: updated.totalPpn,
        totalPph22: updated.totalPph22,
        grandTotal: updated.grandTotal,
      },
    })
 
     return NextResponse.json({ data: updated })
   } catch (error) {
     console.error('PUT /api/invoice-tbs/[id] error:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
   }
 }
 
 export async function DELETE(_: Request, { params }: { params: { id: string } }) {
   try {
    const guard = await requireRole(['ADMIN', 'PEMILIK'])
    if (guard.response) return guard.response
     const id = Number(params.id)
    const existing = await prisma.invoiceTbs.findUnique({ where: { id } })
    await prisma.invoiceTbs.delete({ where: { id } })
    await createAuditLog(guard.id, 'DELETE', 'InvoiceTbs', String(id), {
      number: existing?.number,
      status: existing?.status,
      year: existing?.year,
      month: existing?.month,
    })
     return NextResponse.json({ ok: true })
   } catch (error) {
     console.error('DELETE /api/invoice-tbs/[id] error:', error)
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
   }
 }
