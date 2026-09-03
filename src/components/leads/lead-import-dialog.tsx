"use client";

import { CsvImportDialog } from "@/components/shared/csv-import-dialog";
import {
  LEAD_FIELD_ALIASES,
  LEAD_TEMPLATE_HEADERS,
  LEAD_TEMPLATE_SAMPLE_ROWS,
  validateLeadRow,
} from "@/lib/csv-import";
import { importLeads } from "@/server/actions/import";

export function LeadImportDialog() {
  return (
    <CsvImportDialog
      entityLabel="Leads"
      fieldAliases={LEAD_FIELD_ALIASES}
      templateFilename="sahara-os-leads-template.csv"
      templateHeaders={LEAD_TEMPLATE_HEADERS}
      templateSampleRows={LEAD_TEMPLATE_SAMPLE_ROWS}
      validateRow={validateLeadRow}
      rowSummary={(row) => [row.name, row.mobile, row.area].filter(Boolean).join(" · ")}
      runImport={importLeads}
    />
  );
}
