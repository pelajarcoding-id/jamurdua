import { prisma } from '@/lib/prisma'
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/route-auth';
import { scheduleFileDeletion } from '@/lib/file-retention';
import { parseWibYmd, wibStartUtc } from '@/lib/wib';
import { Prisma } from '@prisma/client';
import { getNotaSawitPphRate } from '@/lib/nota-sawit-pph';

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR', 'SUPIR'])
  if (guard.response) return guard.response
  const id = Number(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  try {
    const nota = await (prisma as any).notaSawit.findUnique({
      where: { id },
      include: {
        timbangan: {
          include: {
            kebun: true,
            supir: true,
            kendaraan: true,
          },
        },
        kebun: true,
        supir: true,
        kendaraan: true,
        pabrikSawit: true,
        pembayaranBatchItems: {
          include: { batch: { select: { id: true, tanggal: true, jumlahMasuk: true, adminBank: true, metodeAlokasi: true } } },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    })

    if (!nota || (nota as any).deletedAt) {
      return NextResponse.json({ error: 'Nota Sawit not found' }, { status: 404 })
    }

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'NotaSawit', entityId: String(id), action: 'CREATE' },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json({
      nota,
      createdBy: audit?.user ? { id: audit.user.id, name: audit.user.name } : null,
      createdAt: audit?.createdAt || null
    });
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
  if (guard.response) return guard.response
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response('Invalid ID format', { status: 400 });
  }

  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id;
    const now = new Date()
    const fallbackPrefix = `Penjualan Sawit #${id} -`

    const { before, trxImages, notaImage } = await prisma.$transaction(async (tx) => {
      const notaSawit = await tx.notaSawit.findUnique({
        where: { id },
        select: { id: true, gambarNotaUrl: true, deletedAt: true },
      })

      if (!notaSawit || notaSawit.deletedAt) {
        return { before: null, trxImages: [] as string[], notaImage: '' }
      }

      const linkedToGajian = await tx.detailGajian.findFirst({
        where: { notaSawitId: id },
        select: { id: true },
      })
      if (linkedToGajian) {
        throw Object.assign(new Error('LINKED_TO_GAJIAN'), { code: 'LINKED_TO_GAJIAN' })
      }

      const trxRows = await tx.kasTransaksi.findMany({
        where: {
          deletedAt: null,
          kategori: 'PENJUALAN_SAWIT',
          OR: [
            { notaSawitId: id } as any,
            { deskripsi: { startsWith: fallbackPrefix } },
          ],
        } as any,
        select: { id: true, gambarUrl: true },
      })
      const trxIds = trxRows.map((t) => t.id)
      if (trxIds.length > 0) {
        await tx.jurnal.deleteMany({
          where: {
            refType: 'KasTransaksi',
            refId: { in: trxIds },
          },
        })
        await tx.kasTransaksi.updateMany({
          where: { id: { in: trxIds } },
          data: { deletedAt: now, deletedById: currentUserId },
        })
      }

      await tx.notaSawit.update({
        where: { id },
        data: {
          deletedAt: now,
          deletedById: currentUserId,
        },
      })

      return {
        before: notaSawit,
        trxImages: trxRows.map((t) => t.gambarUrl).filter((u): u is string => !!u),
        notaImage: notaSawit.gambarNotaUrl || '',
      }
    })

    if (!before) {
      return new Response('Nota Sawit not found', { status: 404 })
    }

    if (notaImage) {
      await scheduleFileDeletion({
        url: notaImage,
        entity: 'NotaSawit',
        entityId: String(id),
        reason: 'DELETE_NOTA',
      })
    }
    for (const url of trxImages) {
      await scheduleFileDeletion({
        url,
        entity: 'KasTransaksi',
        entityId: String(id),
        reason: 'DELETE_NOTA',
      })
    }

    await createAuditLog(currentUserId, 'DELETE', 'NotaSawit', String(id), { before })

    return Response.json({ ok: true })
  } catch (error: any) {
    if (error.code === 'LINKED_TO_GAJIAN' || error.code === 'P2003') {
      return NextResponse.json({ error: 'nota sawit tidak bisa dihapus karena sudah ada di gajian' }, { status: 409 });
    }
    console.error('Error deleting nota sawit:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(['ADMIN', 'PEMILIK', 'KASIR'])
  if (guard.response) return guard.response
  const id = Number(params.id);
  if (!id) return new Response('Bad id', { status: 400 });

  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? Number(session.user.id) : guard.id;
    const body = await req.json();
    const dataToUpdate: { [key: string]: any } = {};
    const roundInt = (v: any) => Math.round(Number(v) || 0)
    const useTimbanganKebun = body.useTimbanganKebun === true || body.useTimbanganKebun === 'true'

    const supirId = body.supirId;
    const kendaraanPlatNomor = body.kendaraanPlatNomor;
    const pabrikSawitId = body.pabrikSawitId;
    const potongan = body.potongan;
    const hargaPerKg = body.hargaPerKg;
    const statusPembayaran = body.statusPembayaran;
    const tanggalBongkarValue = body.tanggalBongkar;
    const keteranganValue = body.keterangan;
    const grossKg = body.grossKg;
    const tareKg = body.tareKg;
    const bruto = body.bruto;
    const tara = body.tara;
    const netto = body.netto;
    const pembayaranAktualValue = body.pembayaranAktual;
    const pph25Value = body.pph25;
    const hapusGambar = body.hapusGambar === true || body.hapusGambar === 'true';

    const timbanganId = body.timbanganId;
    const disconnectTimbangan = body.disconnectTimbangan === true || body.disconnectTimbangan === 'true';
    const isManual = body.isManual === true || body.isManual === 'true';
    const kebunId = body.kebunId;

    const existingNota = await prisma.notaSawit.findUnique({
      where: { id },
      include: { timbangan: true },
    });

    if (!existingNota || existingNota.deletedAt) {
      return new Response('Nota Sawit not found', { status: 404 });
    }

    if (kebunId) {
      dataToUpdate.kebun = { connect: { id: Number(kebunId) } };
    }

    if (useTimbanganKebun) {
      const grossKgVal = body.grossKg
      const tareKgVal = body.tareKg
      const hasGross = grossKgVal !== null && grossKgVal !== undefined && String(grossKgVal).trim() !== ''
      const hasTare = tareKgVal !== null && tareKgVal !== undefined && String(tareKgVal).trim() !== ''
      if (hasGross && hasTare) {
        const grossKgNum = roundInt(grossKgVal)
        const tareKgNum = roundInt(tareKgVal)
        const netKgNum = Math.max(0, grossKgNum - tareKgNum)

        if (existingNota.timbanganId) {
          await prisma.timbangan.update({
            where: { id: existingNota.timbanganId },
            data: {
              grossKg: grossKgNum,
              tareKg: tareKgNum,
              netKg: netKgNum,
            },
          })
          const targetKebunId = existingNota.timbangan?.kebunId || existingNota.kebunId
          if (targetKebunId) dataToUpdate.kebun = { connect: { id: Number(targetKebunId) } }
        } else {
          const targetKebunId = kebunId ? Number(kebunId) : existingNota.kebunId
          if (!targetKebunId) {
            return new Response('Kebun harus dipilih untuk input timbangan kebun', { status: 400 })
          }
          const newTimbangan = await prisma.timbangan.create({
            data: {
              kebunId: targetKebunId,
              grossKg: grossKgNum,
              tareKg: tareKgNum,
              netKg: netKgNum,
              date: new Date(existingNota.tanggalBongkar || new Date()),
              supirId: existingNota.supirId,
              kendaraanPlatNomor: existingNota.kendaraanPlatNomor || null,
              notes: 'Input dari Nota Sawit',
            },
          })
          dataToUpdate.timbangan = { connect: { id: newTimbangan.id } }
          dataToUpdate.kebun = { connect: { id: Number(targetKebunId) } }
        }
      }
    }

    if (disconnectTimbangan && isManual) {
        const targetKebunId = kebunId ? Number(kebunId) : existingNota.timbangan?.kebunId;
        
        if (targetKebunId) {
             const newTimbangan = await prisma.timbangan.create({
                 data: {
                     kebunId: targetKebunId,
                     grossKg: roundInt(bruto || existingNota.bruto || 0),
                     tareKg: roundInt(tara || existingNota.tara || 0),
                     netKg: roundInt(netto || existingNota.netto || 0),
                     date: new Date(existingNota.tanggalBongkar || new Date()),
                     supirId: existingNota.supirId,
                     notes: "Input Manual (Disconnected from Kebun Timbangan)",
                 }
             });
             dataToUpdate.timbangan = { connect: { id: newTimbangan.id } };
        }
    } else if (timbanganId) {
        dataToUpdate.timbangan = { connect: { id: Number(timbanganId) } };
    }

    if (supirId) {
      dataToUpdate.supir = { connect: { id: Number(supirId) } };
    }
    
    if (tanggalBongkarValue) {
      const raw = String(tanggalBongkarValue).trim()
      const ymd = parseWibYmd(raw)
      if (!ymd) {
        return new Response('Tanggal bongkar tidak valid', { status: 400 })
      }
      dataToUpdate.tanggalBongkar = wibStartUtc(ymd)
    }
    
    if (keteranganValue !== undefined) {
      const raw = keteranganValue !== null ? String(keteranganValue).trim() : ''
      dataToUpdate.keterangan = raw || null
    }

    if (kendaraanPlatNomor !== undefined && kendaraanPlatNomor !== null) {
      if (kendaraanPlatNomor) {
        dataToUpdate.kendaraan = { connect: { platNomor: kendaraanPlatNomor as string } };
      } else {
        dataToUpdate.kendaraan = { disconnect: true };
      }
    }

    if (pabrikSawitId) {
      dataToUpdate.pabrikSawit = { connect: { id: Number(pabrikSawitId) } };
    }

    if (pembayaranAktualValue !== undefined && pembayaranAktualValue !== null) {
        if (pembayaranAktualValue.toString() !== '') {
             dataToUpdate.pembayaranAktual = roundInt(pembayaranAktualValue);
        } else {
             dataToUpdate.pembayaranAktual = null;
        }
    }

    // Update NotaSawit specific weights
    if (bruto !== undefined && bruto !== null) dataToUpdate.bruto = roundInt(bruto);
    if (tara !== undefined && tara !== null) dataToUpdate.tara = roundInt(tara);
    if (netto !== undefined && netto !== null) dataToUpdate.netto = roundInt(netto);

    let timbanganData = { ...existingNota.timbangan };

    // Jangan ubah data timbangan saat edit Nota Sawit; gunakan data timbangan sebagai pembanding saja
    const grossKgNum = timbanganData.grossKg;
    const tareKgNum = timbanganData.tareKg;

    // Calculate effective netto for payment
    let calculationNetto = 0;
    if (netto !== undefined && netto !== null) {
        calculationNetto = roundInt(netto);
    } else {
        // @ts-ignore
        calculationNetto = roundInt((existingNota.netto && existingNota.netto !== 0) ? existingNota.netto : timbanganData.netKg);
    }

    let beratAkhir = Math.max(0, roundInt(calculationNetto - (existingNota.potongan || 0)));
    if (potongan !== undefined && potongan !== null) {
      const potonganNum = roundInt(potongan);
      dataToUpdate.potongan = potonganNum;
      beratAkhir = Math.max(0, calculationNetto - potonganNum);
    }
    dataToUpdate.beratAkhir = beratAkhir;

    if (hargaPerKg !== undefined && hargaPerKg !== null) {
        const hargaPerKgNum = roundInt(hargaPerKg);
        dataToUpdate.hargaPerKg = hargaPerKgNum;
        dataToUpdate.totalPembayaran = roundInt(beratAkhir * hargaPerKgNum);
    } else {
        // Recalculate totalPembayaran if only potongan/timbangan changes
        dataToUpdate.totalPembayaran = roundInt(beratAkhir * (existingNota.hargaPerKg || 0));
    }

    const effectivePabrikSawitId = pabrikSawitId ? Number(pabrikSawitId) : Number((existingNota as any).pabrikSawitId)
    const effectiveTanggalBongkar = dataToUpdate.tanggalBongkar ? new Date(dataToUpdate.tanggalBongkar as any) : (existingNota as any).tanggalBongkar ? new Date((existingNota as any).tanggalBongkar) : new Date()
    const requestedPerusahaanId = body?.perusahaanId ? Number(body.perusahaanId) : null
    const requestedId = Number.isFinite(requestedPerusahaanId) && (requestedPerusahaanId as number) > 0 ? (requestedPerusahaanId as number) : null

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
    const linkedIds = linkExists
      ? await prisma.$queryRaw<any[]>(
          Prisma.sql`SELECT "perusahaanId"::int as id, "isDefault"::boolean as "isDefault" FROM "PabrikSawitPerusahaan" WHERE "pabrikSawitId" = ${effectivePabrikSawitId}`,
        )
      : []
    const allowed = new Set<number>((linkedIds || []).map((r) => Number(r?.id)).filter((n) => Number.isFinite(n) && n > 0))
    if (requestedId && allowed.size > 0 && !allowed.has(requestedId)) {
      return NextResponse.json({ error: 'Perusahaan tidak terikat dengan pabrik sawit' }, { status: 400 })
    }

    const pabrik = await prisma.pabrikSawit.findUnique({ where: { id: effectivePabrikSawitId }, select: { perusahaanId: true } as any })
    const defaultPabrikId = (pabrik as any)?.perusahaanId ? Number((pabrik as any).perusahaanId) : null
    const defaultFromLink = (linkedIds || []).find((r) => Boolean(r?.isDefault))
    const defaultLinkId = defaultFromLink ? Number(defaultFromLink.id) : null
    const resolvedPerusahaanId =
      requestedId ||
      (defaultPabrikId && Number.isFinite(defaultPabrikId) && defaultPabrikId > 0 ? defaultPabrikId : null) ||
      (defaultLinkId && Number.isFinite(defaultLinkId) && defaultLinkId > 0 ? defaultLinkId : null) ||
      (allowed.size === 1 ? Array.from(allowed)[0] : null)
    if (!resolvedPerusahaanId && allowed.size > 1) {
      return NextResponse.json({ error: 'Perusahaan wajib dipilih untuk pabrik ini' }, { status: 400 })
    }

    dataToUpdate.perusahaanId = resolvedPerusahaanId
    const pphRateApplied = resolvedPerusahaanId ? await getNotaSawitPphRate({ perusahaanId: resolvedPerusahaanId, tanggal: effectiveTanggalBongkar }) : 0.0025

    const newTotalPembayaran = dataToUpdate.totalPembayaran;
    const newPph = Math.round(newTotalPembayaran * pphRateApplied);
    dataToUpdate.pph = newPph;
    dataToUpdate.pphRateApplied = pphRateApplied;

    if (pph25Value !== undefined && pph25Value !== null) {
        dataToUpdate.pph25 = roundInt(pph25Value);
    }
    // @ts-ignore
    const currentPph25 = (pph25Value !== undefined && pph25Value !== null) ? roundInt(pph25Value) : roundInt(existingNota.pph25 || 0);

    dataToUpdate.pembayaranSetelahPph = roundInt(newTotalPembayaran - newPph - currentPph25);

    if (statusPembayaran) {
        dataToUpdate.statusPembayaran = statusPembayaran as string;
    }

    if (hapusGambar && existingNota.gambarNotaUrl) {
        await scheduleFileDeletion({
          url: existingNota.gambarNotaUrl,
          entity: 'NotaSawit',
          entityId: String(id),
          reason: 'REMOVE_IMAGE',
        })
        dataToUpdate.gambarNotaUrl = null;
    }

    const gambarNotaUrl = body.gambarNotaUrl;
    if (gambarNotaUrl) {
        if (existingNota.gambarNotaUrl) {
            await scheduleFileDeletion({
              url: existingNota.gambarNotaUrl,
              entity: 'NotaSawit',
              entityId: String(id),
              reason: 'REPLACE_IMAGE',
            })
        }
        dataToUpdate.gambarNotaUrl = gambarNotaUrl;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return Response.json(existingNota);
    }

    const updatedNota = await prisma.notaSawit.update({
      where: { id },
      data: dataToUpdate,
      include: {
        pabrikSawit: true,
        supir: true,
        timbangan: true,
        kebun: true,
      }
    });

    // INTEGRATION: Sync update to KasTransaksi if status is LUNAS (skip if already reconciled via batch)
    if (updatedNota.statusPembayaran === 'LUNAS') {
        const hasBatch = await (prisma as any).notaSawitPembayaranBatchItem.findFirst({
            where: { notaSawitId: updatedNota.id },
            select: { id: true },
        })
        if (hasBatch) {
            await createAuditLog(currentUserId, 'UPDATE', 'NotaSawit', String(id), {
                before: existingNota,
                after: updatedNota,
                changedFields: Object.keys(dataToUpdate),
                note: 'Skip KasTransaksi sync because nota is reconciled via batch',
            })
            return Response.json(updatedNota)
        }

        const kasTransaction = await prisma.kasTransaksi.findFirst({
            where: {
                kategori: 'PENJUALAN_SAWIT',
                deskripsi: {
                    contains: `Penjualan Sawit #${updatedNota.id}`
                }
            }
        });

        if (kasTransaction) {
            const pabrikName = updatedNota.pabrikSawit?.name || 'Unknown Pabrik';
            const supirName = updatedNota.supir?.name || 'Unknown Supir';
            const tglBongkar = updatedNota.tanggalBongkar 
                ? new Date(updatedNota.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : '-';
            
            const newDescription = `Penjualan Sawit #${updatedNota.id} - ${updatedNota.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`;
            const newAmount = updatedNota.pembayaranAktual ?? updatedNota.pembayaranSetelahPph;

            // Update KasTransaksi
            await prisma.kasTransaksi.update({
                where: { id: kasTransaction.id },
                data: {
                    deskripsi: newDescription,
                    jumlah: newAmount,
                    // Also update relations if changed
                    kebunId: updatedNota.timbangan?.kebunId,
                    kendaraanPlatNomor: updatedNota.kendaraanPlatNomor || null,
                }
            });

            await createAuditLog(currentUserId, 'UPDATE', 'KasTransaksi', String(kasTransaction.id), {
                source: 'NotaSawitSync',
                notaSawitId: id,
                deskripsi: newDescription,
                jumlah: newAmount,
            });

            // Update Jurnal: Delete old and create new (easiest way to ensure consistency)
            await prisma.jurnal.deleteMany({
                where: {
                    refType: 'KasTransaksi',
                    refId: kasTransaction.id
                }
            });

            await prisma.jurnal.createMany({
                data: [
                    {
                        date: kasTransaction.date, // Keep original transaction date
                        akun: 'Kas',
                        deskripsi: newDescription,
                        debit: newAmount,
                        kredit: 0,
                        refType: 'KasTransaksi',
                        refId: kasTransaction.id,
                    },
                    {
                        date: kasTransaction.date,
                        akun: 'Pendapatan Sawit',
                        deskripsi: newDescription,
                        debit: 0,
                        kredit: newAmount,
                        refType: 'KasTransaksi',
                        refId: kasTransaction.id,
                    },
                ],
            });
        } else {
            // Create new KasTransaksi and Jurnal if not exists
            const session = await auth();
            const currentUserId = session?.user?.id ? Number(session.user.id) : 1;

            const pemilik = await prisma.user.findFirst({
                where: { role: 'PEMILIK' }
            });
            const transactionUserId = pemilik ? pemilik.id : currentUserId;

            const pabrikName = updatedNota.pabrikSawit?.name || 'Unknown Pabrik';
            const supirName = updatedNota.supir?.name || 'Unknown Supir';
            const tglBongkar = updatedNota.tanggalBongkar 
                ? new Date(updatedNota.tanggalBongkar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                : '-';
            
            const description = `Penjualan Sawit #${updatedNota.id} - ${updatedNota.kendaraanPlatNomor || 'Tanpa Plat'} - ${pabrikName} (${tglBongkar}) - Supir: ${supirName}`;
            const amount = updatedNota.pembayaranAktual ?? updatedNota.pembayaranSetelahPph;

            const kasTrx = await prisma.kasTransaksi.create({
                data: {
                    date: new Date(),
                    tipe: 'PEMASUKAN',
                    deskripsi: description,
                    jumlah: amount,
                    kategori: 'PENJUALAN_SAWIT',
                    kebunId: updatedNota.timbangan?.kebunId,
                    kendaraanPlatNomor: updatedNota.kendaraanPlatNomor || undefined,
                    userId: transactionUserId,
                }
            });

            await createAuditLog(currentUserId, 'CREATE', 'KasTransaksi', String(kasTrx.id), {
                source: 'NotaSawitSync',
                notaSawitId: id,
                deskripsi: description,
                jumlah: amount,
            });

            await prisma.jurnal.createMany({
                data: [
                    {
                        date: new Date(),
                        akun: 'Kas',
                        deskripsi: description,
                        debit: amount,
                        kredit: 0,
                        refType: 'KasTransaksi',
                        refId: kasTrx.id,
                    },
                    {
                        date: new Date(),
                        akun: 'Pendapatan Sawit',
                        deskripsi: description,
                        debit: 0,
                        kredit: amount,
                        refType: 'KasTransaksi',
                        refId: kasTrx.id,
                    },
                ],
            });
        }
    }

    await createAuditLog(currentUserId, 'UPDATE', 'NotaSawit', String(id), {
        before: existingNota,
        after: updatedNota,
        changedFields: Object.keys(dataToUpdate),
    });

    return Response.json(updatedNota);
  } catch (error) {
    console.error('Error updating nota sawit:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
