import { NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  collectBusinessExportDatasets,
  buildWorkbook,
  buildCsv,
  buildDataDictionary,
  buildReadme,
} from "@/server/business-export";

export const runtime = "nodejs";

/**
 * Owner-only monthly portable business-data export (2026-09-22 master
 * prompt §9-11) — SAHARA_DATA_YYYY-MM.zip containing one XLSX workbook, one
 * CSV per table, a data dictionary, a README and a structured JSON copy.
 * Built entirely in memory and streamed straight to the response; nothing
 * is written to the server's disk (§13's "generate → compress → download →
 * delete temporary files" is satisfied by simply never creating a file).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden — Owner/Admin only", { status: 403 });

  const now = new Date();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const datasets = await collectBusinessExportDatasets();
  const workbookBuffer = buildWorkbook(datasets);
  const dataDictionary = buildDataDictionary(datasets);
  const readme = buildReadme(monthLabel, datasets);
  const jsonExport = JSON.stringify(
    Object.fromEntries(datasets.map((d) => [d.name, d.rows])),
    null,
    2
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  archive.append(workbookBuffer, { name: `Sahara_Data_${monthLabel}.xlsx` });
  for (const { name, rows } of datasets) {
    archive.append(buildCsv(rows), { name: `${name}.csv` });
  }
  archive.append(dataDictionary, { name: "Data_Dictionary.md" });
  archive.append(readme, { name: "README.txt" });
  archive.append(jsonExport, { name: "sahara_data.json" });

  const totalRows = datasets.reduce((sum, d) => sum + d.rows.length, 0);
  const finalizePromise = archive.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  await finalizePromise;
  const zipBuffer = Buffer.concat(chunks);

  await db.auditLog
    .create({
      data: {
        entityType: "BusinessExport",
        entityId: monthLabel,
        action: "EXPORT",
        summary: `Business data export generated (${totalRows} total rows, ${(zipBuffer.length / 1024).toFixed(0)} KB)`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="SAHARA_DATA_${monthLabel}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
