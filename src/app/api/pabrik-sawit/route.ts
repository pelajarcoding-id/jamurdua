import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';
import { getWibRangeUtcFromParams } from '@/lib/wib';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic'

// GET /api/pabrik-sawit
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const search = searchParams.get('search') || '';
  const perusahaanId = searchParams.get('perusahaanId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Remove date filtering on PabrikSawit itself to show all factories
  // The date filter will be applied to the statistics instead
  const where: any = {};
  if (perusahaanId) {
    where.perusahaanId = parseInt(perusahaanId, 10);
  }

  try {
    const allPabrik = await (prisma as any).pabrikSawit.findMany({
      where,
      include: {
        perusahaan: {
          select: { id: true, name: true }
        }
      } as any,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const hasSettingTable = async () => {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'PerusahaanNotaSawitSetting'
        ) AS "exists"`
      )
      return Boolean(rows?.[0]?.exists)
    }
    const hasLinkTable = async () => {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'PabrikSawitPerusahaan'
        ) AS "exists"`,
      )
      return Boolean(rows?.[0]?.exists)
    }
    const perusahaanIds = Array.from(new Set(allPabrik.map((p: any) => Number(p?.perusahaanId)).filter((n: number) => Number.isFinite(n) && n > 0)))
    const settingMap = new Map<number, number>()
    if (perusahaanIds.length > 0) {
      const exists = await hasSettingTable().catch(() => false)
      if (exists) {
        const rows = await prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT "perusahaanId","pphRate" FROM "PerusahaanNotaSawitSetting" WHERE "perusahaanId" IN (${Prisma.join(perusahaanIds)})`,
        )
        for (const r of rows || []) {
          const pid = Number(r?.perusahaanId)
          const rate = Number(r?.pphRate)
          if (Number.isFinite(pid) && pid > 0 && Number.isFinite(rate)) settingMap.set(pid, rate)
        }
      }
    }
    const linkExists = await hasLinkTable().catch(() => false)
    const perusahaanByPabrik = new Map<number, Array<{ id: number; name: string; isDefault: boolean }>>()
    if (linkExists && allPabrik.length > 0) {
      const pabrikIdsAll = Array.from(new Set(allPabrik.map((p: any) => Number(p?.id)).filter((n: number) => Number.isFinite(n) && n > 0)))
      if (pabrikIdsAll.length > 0) {
        const rows = await prisma.$queryRaw<any[]>(
          Prisma.sql`
            SELECT l."pabrikSawitId"::int as "pabrikSawitId", l."perusahaanId"::int as "perusahaanId", l."isDefault"::boolean as "isDefault", pr."name" as "name"
            FROM "PabrikSawitPerusahaan" l
            JOIN "Perusahaan" pr ON pr.id = l."perusahaanId"
            WHERE l."pabrikSawitId" IN (${Prisma.join(pabrikIdsAll)})
            ORDER BY l."isDefault" DESC, pr."name" ASC
          `,
        )
        for (const r of rows || []) {
          const pid = Number(r?.pabrikSawitId)
          const cid = Number(r?.perusahaanId)
          const name = String(r?.name || '')
          const isDefault = Boolean(r?.isDefault)
          if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(cid) || cid <= 0) continue
          const prev = perusahaanByPabrik.get(pid) || []
          prev.push({ id: cid, name: name || `Perusahaan #${cid}`, isDefault })
          perusahaanByPabrik.set(pid, prev)
        }
      }
    }

    const filteredPabrik = allPabrik.filter((p: any) => {
      if (!search) return true;
      return (
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.address && p.address.toLowerCase().includes(search.toLowerCase()))
      );
    });

    const page = parseInt(pageParam || '1');
    const limit = parseInt(limitParam || '10');
    const skip = (page - 1) * limit;

    const total = filteredPabrik.length;
    const paginatedData = filteredPabrik.slice(skip, skip + limit);

    // Calculate stats for the paginated data
    const notaWhere: any = {};
    if (startDate || endDate) {
      const range = getWibRangeUtcFromParams(searchParams)
      if (!range) {
        return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
      }
      notaWhere.tanggalBongkar = {
        gte: range.startUtc,
        lt: range.endExclusiveUtc,
      }
    }

    const pabrikIds = paginatedData.map((p: any) => p.id);
    
    const stats = await prisma.notaSawit.groupBy({
        by: ['pabrikSawitId'],
        where: {
            ...notaWhere,
            pabrikSawitId: {
                in: pabrikIds
            }
        },
        _sum: {
            beratAkhir: true,
            totalPembayaran: true,
            potongan: true,
        },
        _count: {
            id: true,
        }
    });

    const data = paginatedData.map((p: any) => {
        const stat = stats.find(s => s.pabrikSawitId === p.id);
        const totalBerat = stat?._sum.beratAkhir || 0;
        const totalNilai = stat?._sum.totalPembayaran || 0;
        const totalPotongan = stat?._sum.potongan || 0;
        const pid = Number(p?.perusahaanId)
        const pphRate = settingMap.get(pid) ?? 0.0025
        const perusahaanOptions = perusahaanByPabrik.get(Number(p?.id)) || []
        
        return {
            ...p,
            pphRate,
            perusahaanOptions,
            stats: {
                totalBerat,
                totalNilai,
                totalNota: stat?._count.id || 0,
                totalPotongan,
                totalBeratNetto: totalBerat + totalPotongan,
                rataRataHarga: totalBerat > 0 ? totalNilai / totalBerat : 0
            }
        };
    });

    return NextResponse.json({
      data,
      total,
    });
  } catch (error) {
    console.error('Error fetching pabrik sawit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/pabrik-sawit
export async function POST(request: Request) {
  try {
    const guard = await requireRole(['ADMIN', 'PEMILIK']);
    if (guard.response) return guard.response;
    const body = await request.json();
    const { name, address } = body;
    const perusahaanIdsRaw = Array.isArray(body?.perusahaanIds) ? body.perusahaanIds : []
    const perusahaanIds = Array.from(
      new Set(
        perusahaanIdsRaw
          .map((v: any) => Number(v))
          .filter((n: number) => Number.isFinite(n) && n > 0),
      ),
    )
    const defaultPerusahaanId = body?.defaultPerusahaanId ? Number(body.defaultPerusahaanId) : body?.perusahaanId ? Number(body.perusahaanId) : null
    const defaultId = Number.isFinite(defaultPerusahaanId) && (defaultPerusahaanId as number) > 0 ? (defaultPerusahaanId as number) : null
    const finalPerusahaanIds = defaultId && !perusahaanIds.includes(defaultId) ? [...perusahaanIds, defaultId] : perusahaanIds

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const hasLinkTable = async () => {
      const rows = await prisma.$queryRaw<any[]>(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'PabrikSawitPerusahaan'
        ) AS "exists"`,
      )
      return Boolean(rows?.[0]?.exists)
    }
    const linkExists = await hasLinkTable().catch(() => false)

    const newPabrikSawit = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).pabrikSawit.create({
        data: {
          name,
          address,
          perusahaanId: defaultId,
        } as any,
      })
      if (linkExists) {
        const pid = Number(created.id)
        if (finalPerusahaanIds.length > 0) {
          await tx.$executeRaw(Prisma.sql`DELETE FROM "PabrikSawitPerusahaan" WHERE "pabrikSawitId" = ${pid}`)
          const values = finalPerusahaanIds.map((cid) =>
            Prisma.sql`(${pid}, ${cid}, ${defaultId === cid}, NOW(), NOW())`,
          )
          await tx.$executeRaw(
            Prisma.sql`INSERT INTO "PabrikSawitPerusahaan" ("pabrikSawitId","perusahaanId","isDefault","createdAt","updatedAt")
                       VALUES ${Prisma.join(values)}`,
          )
        }
      }
      return created
    })

    // Audit Log
    await createAuditLog(guard.id, 'CREATE', 'PabrikSawit', newPabrikSawit.id.toString(), {
        name,
        address,
        perusahaanIds: finalPerusahaanIds,
        defaultPerusahaanId: defaultId,
    });

    return NextResponse.json(newPabrikSawit, { status: 201 });
  } catch (error) {
    console.error('Error creating pabrik sawit:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
