import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = Number(params.id);
        const { akun, deskripsi, debit, kredit } = await request.json();

        if (!akun || (debit === 0 && kredit === 0)) {
            return NextResponse.json({ error: 'Akun dan salah satu dari Debit atau Kredit harus diisi' }, { status: 400 });
        }

        const updatedJurnal = await prisma.jurnal.update({
            where: { id },
            data: {
                akun,
                deskripsi,
                debit: Number(debit),
                kredit: Number(kredit),
            },
        });

        return NextResponse.json(updatedJurnal);
    } catch (error) {
        console.error(`Error updating jurnal with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        const role = session?.user?.role;
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const id = Number(params.id);

        await prisma.jurnal.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Entri jurnal berhasil dihapus' });
    } catch (error) {
        console.error(`Error deleting jurnal with id: ${params.id}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
