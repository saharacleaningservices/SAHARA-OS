"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { deleteExpense, bulkDeleteExpenses } from "@/server/actions/expenses";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: Date;
  paidTo: string | null;
  staff?: { name: string } | null;
  job?: { jobNumber: string } | null;
};

const PAGE_SIZE = 15;

export function ExpensesExplorer({ expenses }: { expenses: Expense[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (q && !`${e.description} ${e.paidTo ?? ""}`.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
      return true;
    });
  }, [expenses, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search description or vendor..." className="sm:w-72" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkActionsBar
        count={selected.length}
        entityLabel="expense"
        onClear={() => setSelected([])}
        onDelete={() => bulkDeleteExpenses(selected)}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No expenses found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={pageItems.length > 0 && pageItems.every((e) => selected.includes(e.id))}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked
                          ? Array.from(new Set([...prev, ...pageItems.map((e) => e.id)]))
                          : prev.filter((id) => !pageItems.some((e) => e.id === id))
                      )
                    }
                  />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => (checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{e.description}</p>
                    {e.job && <p className="text-xs text-muted-foreground">{e.job.jobNumber}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.paidTo ?? e.staff?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatINR(e.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EditExpenseDialog expense={e} />
                      <ConfirmDeleteButton action={deleteExpense} id={e.id} entityLabel="expense" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
