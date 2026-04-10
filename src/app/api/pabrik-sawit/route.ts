import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/route-auth';
import { getWibRangeUtcFromParams } from '@/lib/wib';

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
    const allPabrik = await prisma.pabrikSawit.findMany({
      where,
      include: {
        perusahaan: {
          select: { name: true }
        }
      } as any,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const filteredPabrik = allPabrik.filter(p => {
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

    const pabrikIds = paginatedData.map(p => p.id);
    
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

    const data = paginatedData.map(p => {
        const stat = stats.find(s => s.pabrikSawitId === p.id);
        const totalBerat = stat?._sum.beratAkhir || 0;
        const totalNilai = stat?._sum.totalPembayaran || 0;
        const totalPotongan = stat?._sum.potongan || 0;
        
        return {
            ...p,
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
    const { name, address, perusahaanId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newPabrikSawit = await prisma.pabrikSawit.create({
      data: {
        name,
        address,
        perusahaanId: perusahaanId ? parseInt(perusahaanId) : null
      } as any,
    });

    // Audit Log
    await createAuditLog(guard.id, 'CREATE', 'PabrikSawit', newPabrikSawit.id.toString(), {
        name,
        address,
        perusahaanId
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
