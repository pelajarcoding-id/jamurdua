
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile } from "@/lib/storage";

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadFile({
      bytes: buffer,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      folder: folder || undefined,
    });

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("Error uploading file");
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
