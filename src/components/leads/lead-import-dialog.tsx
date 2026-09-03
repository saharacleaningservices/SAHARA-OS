"use client";

import { useMemo } from "react";
import { Upload } from "lucide-react";
import { CsvImportDialog } from "@/components/shared/csv-import-dialog";
import { Button } from "@/components/ui/button";
import {
  LEAD_FIELD_ALIASES,
  LEAD_TEMPLATE_HEADERS,
  LEAD_TEMPLATE_SAMPLE_ROWS,
  buildUserDirectory,
  validateLeadRow,
} from "@/lib/csv-import";
import { importLeads } from "@/server/actions/import";

type UserOption = { id: string; name: string; role: string };

export function LeadImportDialog({ userOptions = [] }: { userOptions?: UserOption[] }) {
  const userDirectory = useMemo(() => buildUserDirectory(userOptions), [userOptions]);

  return (
    <CsvImportDialog
      entityLabel="Leads"
      fieldAliases={LEAD_FIELD_ALIASES}
      templateFilename="sahara-os-leads-template.csv"
      templateHeaders={LEAD_TEMPLATE_HEADERS}
      templateSampleRows={LEAD_TEMPLATE_SAMPLE_ROWS}
      validateRow={(row) => validateLeadRow(row, userDirectory)}
      rowSummary={(row) => [row.name, row.mobile, row.area, row.assignedTo].filter(Boolean).join(" · ")}
      runImport={importLeads}
      trigger={
        <Button variant="outline" size="sm">
          <Upload className="size-3.5" /> Import Leads
        </Button>
      }
    />
  );
}
