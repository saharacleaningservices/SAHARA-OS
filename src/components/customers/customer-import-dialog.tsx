"use client";

import { Upload } from "lucide-react";
import { CsvImportDialog } from "@/components/shared/csv-import-dialog";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_FIELD_ALIASES,
  CUSTOMER_TEMPLATE_HEADERS,
  CUSTOMER_TEMPLATE_SAMPLE_ROWS,
  validateCustomerRow,
} from "@/lib/csv-import";
import { importCustomers } from "@/server/actions/import";

export function CustomerImportDialog() {
  return (
    <CsvImportDialog
      entityLabel="Customers"
      fieldAliases={CUSTOMER_FIELD_ALIASES}
      templateFilename="sahara-os-customers-template.csv"
      templateHeaders={CUSTOMER_TEMPLATE_HEADERS}
      templateSampleRows={CUSTOMER_TEMPLATE_SAMPLE_ROWS}
      validateRow={validateCustomerRow}
      rowSummary={(row) => [row.name, row.mobile, row.area, row.outstandingBalance].filter(Boolean).join(" · ")}
      runImport={importCustomers}
      trigger={
        <Button variant="outline" size="sm">
          <Upload className="size-3.5" /> Import Customers
        </Button>
      }
    />
  );
}
