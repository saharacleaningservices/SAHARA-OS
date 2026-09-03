"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Download, Loader2, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { parseImportFile, type CsvRow, type RowValidation } from "@/lib/csv-import";
import type { ImportRowResult, ImportSummary } from "@/server/actions/import";

function downloadTemplateCsv(filename: string, headers: string[], sampleRows: string[][]) {
  const escape = (val: string) => (/[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val);
  const lines = [headers.map(escape).join(","), ...sampleRows.map((row) => row.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type PreviewRow<T> = { rowNumber: number; raw: CsvRow; validation: RowValidation<T> };

export function CsvImportDialog<T>({
  entityLabel,
  fieldAliases,
  templateFilename,
  templateHeaders,
  templateSampleRows,
  validateRow,
  rowSummary,
  runImport,
  trigger,
}: {
  entityLabel: string;
  fieldAliases: Record<string, string[]>;
  templateFilename: string;
  templateHeaders: string[];
  templateSampleRows: string[][];
  validateRow: (row: CsvRow) => RowValidation<T>;
  rowSummary: (row: CsvRow) => string;
  runImport: (rows: T[]) => Promise<ImportSummary>;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow<T>[]>([]);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setFileName(null);
    setPreviewRows([]);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResults(null);
    setFileName(file.name);
    try {
      const rows = await parseImportFile(file, fieldAliases);
      if (rows.length === 0) {
        toast.error("Couldn't find any rows in that file");
        setPreviewRows([]);
        return;
      }
      setPreviewRows(rows.map((raw, idx) => ({ rowNumber: idx + 2, raw, validation: validateRow(raw) })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that file");
      setPreviewRows([]);
    }
  }

  const validRows = previewRows.filter((r) => r.validation.ok) as (PreviewRow<T> & { validation: { ok: true; data: T } })[];
  const invalidCount = previewRows.length - validRows.length;

  function submit() {
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    startTransition(async () => {
      const res = await runImport(validRows.map((r) => r.validation.data));
      setResults(res.results);
      if (res.created > 0) {
        toast.success(`Imported ${res.created} of ${validRows.length} row${validRows.length === 1 ? "" : "s"}`);
        router.refresh();
      } else {
        toast.error("Nothing was imported — see details below");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Upload className="size-3.5" /> Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {entityLabel} from CSV or Excel</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel (.xlsx/.xls) file — download the template first if you're not sure of the columns.
            Each row is checked before anything is saved, and duplicates (matching mobile number) are skipped
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplateCsv(templateFilename, templateHeaders, templateSampleRows)}
            >
              <Download className="size-3.5" /> Download template
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-3.5" /> Choose CSV or Excel file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={handleFile}
            />
            {fileName && <span className="truncate text-xs text-muted-foreground">{fileName}</span>}
            {previewRows.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          {previewRows.length > 0 && !results && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{validRows.length} ready to import</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    {invalidCount} row{invalidCount === 1 ? "" : "s"} need fixing
                  </Badge>
                )}
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {previewRows.map((r) => (
                  <div key={r.rowNumber} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-xs">
                    {r.validation.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                      <span className="text-muted-foreground">Row {r.rowNumber}: </span>
                      <span className="text-foreground">{rowSummary(r.raw) || "(blank)"}</span>
                      {!r.validation.ok && <p className="text-destructive">{r.validation.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewRows.length === 0 && !results && (
            <EmptyState
              icon={<Upload className="size-6" />}
              title="No file selected"
              description={`Choose a CSV or Excel file to preview its ${entityLabel.toLowerCase()} before importing.`}
            />
          )}

          {results && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{results.filter((r) => r.status === "created").length} created</Badge>
                {results.some((r) => r.status === "skipped") && (
                  <Badge variant="warning">{results.filter((r) => r.status === "skipped").length} skipped (duplicates)</Badge>
                )}
                {results.some((r) => r.status === "invalid") && (
                  <Badge variant="destructive">{results.filter((r) => r.status === "invalid").length} invalid</Badge>
                )}
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {results.map((r) => (
                  <div key={r.row} className="flex items-start gap-2 px-1.5 py-1 text-xs">
                    {r.status === "created" && <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />}
                    {r.status === "skipped" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />}
                    {r.status === "invalid" && <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />}
                    <span>
                      <span className="text-muted-foreground">Row {r.row}: </span>
                      {r.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {results ? "Done" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={submit} disabled={pending || validRows.length === 0}>
              {pending ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
              Import {validRows.length > 0 ? `${validRows.length} row${validRows.length === 1 ? "" : "s"}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
