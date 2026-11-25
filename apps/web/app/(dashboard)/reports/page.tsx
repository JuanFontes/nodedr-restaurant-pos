"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission, useCurrentUser } from "@/hooks/use-auth";
import { useBranch } from "@/hooks/use-branch";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SchedulesPanel } from "@/components/reports/schedules-panel";
import { openEntity } from "@/lib/entity-events";

interface CatalogEntry {
  key: string;
  title: string;
  group: string;
}
interface ReportResult {
  key: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  totals?: (string | number | null)[];
  rowOrderIds?: string[];
}

// Local calendar date, not UTC: after midnight in India the UTC date is still
// yesterday, which made "today" show the wrong day.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const PRESETS: { label: string; get: () => { from: string; to: string } }[] = [
  { label: "Today", get: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { label: "Yesterday", get: () => ({ from: daysAgo(1), to: daysAgo(1) }) },
  { label: "Last 7 days", get: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  {
    label: "This month",
    get: () => {
      const n = new Date();
      return { from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: daysAgo(0) };
    },
  },
  { label: "Last 30 days", get: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
];
const MONEY_COLS = /sales|tax|discount|tips|total|amount|refund|revenue|cost|margin|value|price/i;
const money = (v: string | number | null, col: string) =>
  typeof v === "number" && MONEY_COLS.test(col)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (v ?? "—");

export default function ReportsPage() {
  const { branchId } = useBranch();
  const { data: me } = useCurrentUser();
  const canExport = hasPermission(me?.user, "data.export");
  const [key, setKey] = useState("sales-daily");
  const [range, setRange] = useState(() => ({
    from: daysAgo(6),
    to: daysAgo(0),
  }));

  const { data: catalog } = useQuery({
    queryKey: ["reports", "catalog"],
    queryFn: () => api.get<CatalogEntry[]>("/reports"),
  });
  const qs = `branchId=${branchId}&from=${range.from}&to=${range.to}`;
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", key, branchId, range.from, range.to],
    queryFn: () => api.get<ReportResult>(`/reports/${key}?${qs}`),
    enabled: !!branchId && range.from <= range.to,
    retry: false,
  });

  const groups = [...new Set(catalog?.map((c) => c.group))];

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Pick a day or range, open any bill, then print or export to Excel, PDF or CSV</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-4 print:hidden" aria-label="Reports">
          {groups.map((g) => (
            <div key={g} className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</p>
              {catalog
                ?.filter((c) => c.group === g)
                .map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setKey(c.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                      key === c.key ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
                    )}
                  >
                    {c.title}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            {PRESETS.map((p) => {
              const r = p.get();
              const on = r.from === range.from && r.to === range.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Input aria-label="Report from date" type="date" className="w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <Input aria-label="Report to date" type="date" className="w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            {canExport &&
              (["xlsx", "pdf", "csv"] as const).map((f) => (
                <a
                  key={f}
                  href={`/api/v1/reports/${key}/export?${qs}&format=${f}`}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-secondary"
                >
                  <Download className="mr-2 h-4 w-4" /> {f === "xlsx" ? "Excel" : f.toUpperCase()}
                </a>
              ))}
          </div>

          <Card className="overflow-x-auto p-4">
            <h2 className="mb-3 text-lg font-semibold text-foreground">{data?.title ?? catalog?.find((c) => c.key === key)?.title}</h2>
            <p className="mb-3 hidden text-xs text-muted-foreground print:block">
              {range.from} to {range.to}
            </p>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : error ? (
              <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load report"}</p>
            ) : data && data.rows.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    {data.columns.map((c) => (
                      <th key={c} className="py-1 pr-4 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const orderId = data.rowOrderIds?.[i];
                    const dayDrill = key === "sales-daily" && typeof r[0] === "string";
                    const go = () => {
                      if (orderId) openEntity("Order", orderId);
                      else if (dayDrill) {
                        setKey("invoices");
                        setRange({ from: String(r[0]), to: String(r[0]) });
                      }
                    };
                    const clickable = !!orderId || dayDrill;
                    return (
                      <tr
                        key={i}
                        className={cn("border-t border-border", clickable && "cursor-pointer hover:bg-secondary/50")}
                        {...(clickable
                          ? {
                              onClick: go,
                              tabIndex: 0,
                              role: "button",
                              "aria-label": orderId ? `Open bill ${r[2]}` : `Show every bill on ${r[0]}`,
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  go();
                                }
                              },
                            }
                          : {})}
                      >
                        {r.map((cell, j) => (
                          <td key={j} className="py-1.5 pr-4 tabular-nums">{money(cell, data.columns[j])}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                {data.totals && (
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      {data.totals.map((cell, j) => (
                        <td key={j} className="py-2 pr-4 tabular-nums">{money(cell, data.columns[j])}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No data for this period.</p>
            )}
          </Card>

          {canExport && (
            <SchedulesPanel
              branchId={branchId}
              reportKey={key}
              titles={Object.fromEntries((catalog ?? []).map((c) => [c.key, c.title]))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
