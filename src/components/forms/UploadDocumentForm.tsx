"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function UploadDocumentForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      toast.success("File uploaded");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.zip"
      />
      <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}
