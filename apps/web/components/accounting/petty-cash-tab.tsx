"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusNote, useStatusNote } from "@/components/ui/status-note";
import { usePettyCash, usePettyCashActions } from "@/hooks/use-accounting";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");
// One key per attempt: a double tap or a retry sends the same key and posts once. A new key is made after success.
const newKey = () => crypto.randomUUID();
const cents = (v: string) => Math.round(Number(v) * 100);

export function PettyCashTab({ branchId }: { branchId: string | null }) {
  const { data, isLoading, error } = usePettyCash(branchId);
  const { topup, voucher, count } = usePettyCashActions(branchId);
  const { note, show, clear } = useStatusNote();
  const [top, setTop] = useState({ amount: "", note: "", key: newKey() });
  const [v, setV] = useState({ amount: "", category: "", payee: "", receiptRef: "", note: "", key: newKey() });
  const [c, setC] = useState({ counted: "", note: "", key: newKey() });
  const balance = Number(data?.balance ?? 0);
  const diff = c.counted === "" ? null : (cents(c.counted) - Math.round(balance * 100)) / 100;
  const valid = (s: string) => Number(s) > 0 && cents(s) / 100 === Number(s);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In the petty cash box</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-9 w-40" />
          ) : (
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatCurrency(balance)}</p>
          )}
        </div>
        <StatusNote note={note} onClear={clear} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <form
          className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid(top.amount)) return show("error", "Enter an amount with at most two decimals");
            topup.mutate(
              { amount: Number(top.amount), note: top.note || undefined, clientRequestId: top.key },
              {
                onSuccess: () => {
                  show("success", `Added ${formatCurrency(Number(top.amount))} to the box.`);
                  setTop({ amount: "", note: "", key: newKey() });
                },
                onError: (err) => show("error", errMsg(err)),
              },
            );
          }}
        >
          <h3 className="text-sm font-medium text-foreground">Top up</h3>
          <Input aria-label="Top-up amount" inputMode="decimal" placeholder="Amount" value={top.amount} onChange={(e) => setTop({ ...top, amount: e.target.value })} />
          <Input aria-label="Top-up note" placeholder="Note (who gave it)" value={top.note} onChange={(e) => setTop({ ...top, note: e.target.value })} />
          <Button type="submit" disabled={topup.isPending}>Add to box</Button>
        </form>

        <form
          className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid(v.amount) || !v.category.trim()) return show("error", "Enter an amount and a category");
            voucher.mutate(
              {
                amount: Number(v.amount),
                category: v.category.trim(),
                payee: v.payee || undefined,
                receiptRef: v.receiptRef || undefined,
                note: v.note || undefined,
                clientRequestId: v.key,
              },
              {
                onSuccess: () => {
                  show("success", `Paid out ${formatCurrency(Number(v.amount))}.`);
                  setV({ amount: "", category: "", payee: "", receiptRef: "", note: "", key: newKey() });
                },
                onError: (err) => show("error", errMsg(err)),
              },
            );
          }}
        >
          <h3 className="text-sm font-medium text-foreground">Pay out (voucher)</h3>
          <Input aria-label="Voucher amount" inputMode="decimal" placeholder="Amount" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          <Input aria-label="Voucher category" placeholder="Category (Milk, Cleaning…)" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
          <Input aria-label="Paid to" placeholder="Paid to" value={v.payee} onChange={(e) => setV({ ...v, payee: e.target.value })} />
          <Input aria-label="Receipt number" placeholder="Receipt no." value={v.receiptRef} onChange={(e) => setV({ ...v, receiptRef: e.target.value })} />
          <Button type="submit" disabled={voucher.isPending}>Pay out</Button>
        </form>

        <form
          className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          onSubmit={(e) => {
            e.preventDefault();
            if (c.counted === "" || cents(c.counted) / 100 !== Number(c.counted) || Number(c.counted) < 0)
              return show("error", "Enter the cash you counted");
            count.mutate(
              { countedCash: Number(c.counted), note: c.note || undefined, clientRequestId: c.key },
              {
                onSuccess: () => {
                  show("success", diff === 0 ? "The box matches the book." : `Recorded a difference of ${formatCurrency(diff ?? 0)}.`);
                  setC({ counted: "", note: "", key: newKey() });
                },
                onError: (err) => show("error", errMsg(err)),
              },
            );
          }}
        >
          <h3 className="text-sm font-medium text-foreground">Count the box</h3>
          <Input aria-label="Counted cash" inputMode="decimal" placeholder="Cash counted" value={c.counted} onChange={(e) => setC({ ...c, counted: e.target.value })} />
          <Input aria-label="Count note" placeholder="Note" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} />
          {diff !== null && (
            <p className={diff === 0 ? "text-xs text-muted-foreground" : "text-xs font-medium text-warning"} aria-live="polite">
              {diff === 0 ? "Matches the book" : `${diff > 0 ? "Over" : "Short"} by ${formatCurrency(Math.abs(diff))}`}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={count.isPending}>Record count</Button>
        </form>
      </div>

      <Card className="flex flex-col divide-y divide-border p-2">
        {error ? (
          <p className="p-6 text-center text-sm text-destructive">{errMsg(error)}</p>
        ) : isLoading ? (
          <Skeleton className="m-4 h-12" />
        ) : data && data.entries.length > 0 ? (
          data.entries.map((e) => {
            const delta = Number(e.delta);
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    {e.kind === "TOPUP" ? "Top-up" : e.kind === "VOUCHER" ? (e.category ?? "Voucher") : e.countedCash != null ? "Count" : "Adjustment"}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {new Date(e.createdAt).toLocaleString()} · {e.createdBy.name}
                    {e.payee && ` · ${e.payee}`}
                    {e.receiptRef && ` · receipt ${e.receiptRef}`}
                    {e.countedCash != null && ` · counted ${formatCurrency(Number(e.countedCash))}, book ${formatCurrency(Number(e.bookBalance))}`}
                    {e.note && ` · ${e.note}`}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {e.expense?.status === "PENDING" && <Badge variant="outline" className="border-warning font-normal text-warning">Awaiting approval</Badge>}
                  {e.expense?.status === "REJECTED" && <Badge variant="secondary" className="font-normal">Rejected</Badge>}
                  <span className={delta < 0 ? "text-foreground" : "text-success"}>{delta > 0 ? "+" : ""}{formatCurrency(delta)}</span>
                </span>
              </div>
            );
          })
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing in the box yet. Add the opening float with a top-up.</p>
        )}
      </Card>
    </div>
  );
}
