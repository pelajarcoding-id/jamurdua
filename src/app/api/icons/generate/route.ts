import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const size = Number(body.size);
    const dataUrl = String(body.dataUrl || '');
    if (![192, 512].includes(size)) {
      return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
    }
    if (!dataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Invalid dataUrl' }, { status: 400 });
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const dir = join(process.cwd(), 'public', 'icons');
    await mkdir(dir, { recursive: true });
    const filename = join(dir, `icon-${size}x${size}.png`);
    await writeFile(filename, Buffer.from(base64, 'base64'));
    return NextResponse.json({ ok: true, path: `/icons/icon-${size}x${size}.png` });
  } catch (e) {
    console.error('Error generating icon:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

