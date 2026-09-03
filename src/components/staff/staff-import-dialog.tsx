"use client";

import { CsvImportDialog } from "@/components/shared/csv-import-dialog";
import {
  STAFF_FIELD_ALIASES,
  STAFF_TEMPLATE_HEADERS,
  STAFF_TEMPLATE_SAMPLE_ROWS,
  validateStaffRow,
} from "@/lib/csv-import";
import { importStaff } from "@/server/actions/import";

export function StaffImportDialog() {
  return (
    <CsvImportDialog
      entityLabel="Staff"
      fieldAliases={STAFF_FIELD_ALIASES}
      templateFilename="sahara-os-staff-template.csv"
      templateHeaders={STAFF_TEMPLATE_HEADERS}
      templateSampleRows={STAFF_TEMPLATE_SAMPLE_ROWS}
      validateRow={validateStaffRow}
      rowSummary={(row) => [row.name, row.mobile, row.designation].filter(Boolean).join(" · ")}
      runImport={importStaff}
    />
  );
}
