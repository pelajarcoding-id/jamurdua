
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session) {
    console.warn('UPLOAD /api/upload unauthorized', {
      contentType: request.headers.get('content-type') || '',
      ua: request.headers.get('user-agent') || '',
    })
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ua = request.headers.get('user-agent') || ''
    const contentType = request.headers.get('content-type') || ''
    console.log('UPLOAD /api/upload start', {
      userId: (session as any)?.user?.id,
      contentType,
      ua,
    })

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    console.log('UPLOAD /api/upload file', {
      name: file.name,
      type: file.type,
      size: (file as any).size,
      folder: folder || undefined,
      userId: (session as any)?.user?.id,
    })

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadFile({
      bytes: buffer,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      folder: folder || undefined,
    });

    console.log('UPLOAD /api/upload ok', { url: result.url, key: result.key, userId: (session as any)?.user?.id })
    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
