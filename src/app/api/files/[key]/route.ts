import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getObjectBytes } from "@/lib/storage";
import { prisma } from "@/lib/db";

// Streams a stored file. Used in local-fallback mode (no S3). Auth required so
// documents aren't world-readable. The key is a single URL-encoded segment.
export async function GET(
  _req: Request,
  { params }: { params: { key: string } }
) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const key = decodeURIComponent(params.key);
  const attachment = await prisma.attachment.findFirst({
    where: { fileKey: key },
    select: { filename: true, mimeType: true },
  });

  const bytes = await getObjectBytes(key);
  if (!bytes) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": attachment?.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment?.filename ?? key}"`,
    },
  });
}
