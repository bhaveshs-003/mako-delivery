import { prisma } from "@/lib/db";
import { getDownloadUrl } from "@/lib/storage";
import { EmptyState } from "@/components/shared/EmptyState";
import { UploadDocumentForm } from "@/components/forms/UploadDocumentForm";
import { formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function DocumentsTab({ projectId, canUpload }: { projectId: string; canUpload: boolean }) {
  const attachments = await prisma.attachment.findMany({
    where: { projectId, isCurrent: true },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });

  const withUrls = await Promise.all(
    attachments.map(async (a) => ({ ...a, url: await getDownloadUrl(a.fileKey) }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy">Documents</h2>
          <p className="text-sm text-slate">{attachments.length} file(s) · max 25MB each</p>
        </div>
        {canUpload && <UploadDocumentForm projectId={projectId} />}
      </div>

      {withUrls.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" subtitle="Upload mapping sheets, checklists, and other evidence." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <tbody>
              {withUrls.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-bg">
                  <td className="px-4 py-3">
                    <a href={a.url} className="inline-flex items-center gap-2 font-medium text-navy hover:underline" target="_blank" rel="noreferrer">
                      <FileText className="h-4 w-4 text-slate" />
                      {a.filename}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate">{a.uploadedBy.name}</td>
                  <td className="px-4 py-3 text-slate">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-slate">{humanSize(Number(a.fileSize))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
