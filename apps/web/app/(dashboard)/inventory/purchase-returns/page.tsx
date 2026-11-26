"use client";

import { useState } from "react";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusNote, useStatusNote } from "@/components/ui/status-note";
import { useBranch } from "@/hooks/use-branch";
import {
  useCreatePurchaseReturn,
  useGoodsReceipts,
  useIngredients,
  usePriceVariance,
  usePurchaseReturns,
} from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GrnItem { id: string; ingredientId: string; quantity: string; unitCost: string }
interface Grn { id: string; grnNumber: string; receivedAt: string; supplier: { id: string; name: string }; items: GrnItem[] }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const chip = (on: boolean) =>
  cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary");
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}%`);

export default function PurchaseReturnsPage() {
  const { branchId } = useBranch();
  const [tab, setTab] = useState<"returns" | "prices">("returns");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Stock, daily production, purchasing, and food waste</p>
      </div>
      <InventoryTabs />
      <div className="flex gap-2">
        <button type="button" className={chip(tab === "returns")} onClick={() => setTab("returns")}>Return goods</button>
        <button type="button" className={chip(tab === "prices")} onClick={() => setTab("prices")}>Price check</button>
      </div>
      {tab === "returns" ? <Returns branchId={branchId} /> : <Prices branchId={branchId} />}
    </div>
  );
}

function Returns({ branchId }: { branchId: string | null }) {
  const { data: receipts } = useGoodsReceipts(branchId) as { data: Grn[] | undefined };
  const { data: ingredients } = useIngredients(branchId);
  const names = new Map((ingredients ?? []).map((i) => [i.id, i.name]));
  const { data: returns, isLoading } = usePurchaseReturns(branchId);
  const create = useCreatePurchaseReturn(branchId);
  const { note, show, clear } = useStatusNote();
  const [grnId, setGrnId] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  // One key per attempt, renewed after success: a double click or retry takes stock out once.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const grn = receipts?.find((g) => g.id === grnId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(qty)
      .filter(([, v]) => Number(v) > 0)
      .map(([goodsReceiptItemId, v]) => ({ goodsReceiptItemId, quantity: Number(v) }));
    if (!grn || items.length === 0 || !reason.trim()) return show("error", "Choose a receipt, enter a quantity to return and a reason");
    create.mutate(
      { goodsReceiptId: grn.id, reason: reason.trim(), items, clientRequestId: key },
      {
        onSuccess: (r) => {
          const open = Number(r.creditOpen);
          show("success", `${r.returnNumber}: ${formatCurrency(Number(r.totalAmount))} credited${open > 0 ? `; ${formatCurrency(open)} stays as credit with the supplier` : ""}.`);
          setQty({});
          setReason("");
          setKey(crypto.randomUUID());
        },
        onError: (err) => show("error", err instanceof ApiError ? err.message : "Could not record the return"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid gap-3 sm:grid-cols-2">
          <select aria-label="Goods receipt" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={grnId} onChange={(e) => { setGrnId(e.target.value); setQty({}); }}>
            <option value="">Choose the receipt the goods came on…</option>
            {receipts?.map((g) => (
              <option key={g.id} value={g.id}>{g.grnNumber} · {g.supplier.name} · {new Date(g.receivedAt).toLocaleDateString()}</option>
            ))}
          </select>
          <Input aria-label="Reason for the return" placeholder="Reason (spoiled, wrong item…)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {grn && (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {grn.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{names.get(i.ingredientId) ?? "Item"}</span>
                  <span className="text-muted-foreground"> · received {i.quantity} at {formatCurrency(Number(i.unitCost))}</span>
                </span>
                <Input aria-label={`Quantity to return of ${names.get(i.ingredientId) ?? "item"}`} inputMode="decimal" placeholder="Return qty" className="w-28" value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={create.isPending}>Return to supplier</Button>
          <StatusNote note={note} onClear={clear} />
        </div>
      </form>

      <Card className="flex flex-col divide-y divide-border p-2">
        {isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : returns && returns.length > 0 ? (
          returns.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{r.returnNumber}</span>
                <span className="text-muted-foreground"> · {r.supplier.name} · {r.goodsReceipt.grnNumber} · {new Date(r.createdAt).toLocaleDateString()} · {r.reason}</span>
                <span className="block text-xs text-muted-foreground">{r.items.map((i) => `${i.quantity} ${i.ingredient.unit} ${i.ingredient.name}`).join(", ")}</span>
              </span>
              <span className="text-right tabular-nums">
                <span className="block font-medium">{formatCurrency(Number(r.totalAmount))}</span>
                {Number(r.creditOpen) > 0 && <Badge variant="outline" className="border-warning font-normal text-warning">{formatCurrency(Number(r.creditOpen))} open credit</Badge>}
              </span>
            </div>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No goods have been returned to a supplier.</p>
        )}
      </Card>
    </div>
  );
}

function Prices({ branchId }: { branchId: string | null }) {
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [threshold, setThreshold] = useState(5);
  const { data, isLoading, error } = usePriceVariance(branchId, range.from, range.to, threshold);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="From date" type="date" className="w-40" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input aria-label="To date" type="date" className="w-40" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Flag moves of
          <Input aria-label="Flag threshold percent" inputMode="decimal" className="w-20" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0)} />
          % or more
        </label>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load the price check"}</p>
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {data.summary.flaggedLines} price moves and {data.summary.flaggedInvoices} invoices to look at. Paid {formatCurrency(Number(data.summary.paidAboveOrderPrice))} {Number(data.summary.paidAboveOrderPrice) >= 0 ? "above" : "below"} the order prices.
            {data.truncated && " Showing the first 2000 lines; narrow the dates."}
          </p>
          <Card className="overflow-x-auto p-2">
            {data.lines.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>{["Receipt", "Supplier", "Item", "Qty", "Order price", "Paid", "Last price", "vs order", "vs last"].map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => (
                    <tr key={i} className={cn("border-t border-border", l.flagged && "bg-warning/10")}>
                      <td className="px-3 py-1.5">{l.grnNumber}</td>
                      <td className="px-3 py-1.5">{l.supplier}</td>
                      <td className="px-3 py-1.5">{l.ingredient}</td>
                      <td className="px-3 py-1.5 tabular-nums">{l.quantity} {l.unit}</td>
                      <td className="px-3 py-1.5 tabular-nums">{l.poUnitCost ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{l.receivedUnitCost}</td>
                      <td className="px-3 py-1.5 tabular-nums">{l.lastUnitCost ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{pct(l.poVariancePct)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{pct(l.lastVariancePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">No goods were received in this period.</p>
            )}
          </Card>
          {data.invoiceChecks.length > 0 && (
            <Card className="overflow-x-auto p-2">
              <h3 className="px-3 py-2 text-sm font-medium text-foreground">Invoice against receipt</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>{["Receipt", "Invoice", "Supplier", "Received worth", "Invoiced", "Difference"].map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.invoiceChecks.map((c, i) => (
                    <tr key={i} className={cn("border-t border-border", c.flagged && "bg-warning/10")}>
                      <td className="px-3 py-1.5">{c.grnNumber}</td>
                      <td className="px-3 py-1.5">{c.invoiceNumber}</td>
                      <td className="px-3 py-1.5">{c.supplier}</td>
                      <td className="px-3 py-1.5 tabular-nums">{c.receiptTotal}</td>
                      <td className="px-3 py-1.5 tabular-nums">{c.invoiceTotal}</td>
                      <td className="px-3 py-1.5 tabular-nums">{c.difference} ({pct(c.differencePct)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
