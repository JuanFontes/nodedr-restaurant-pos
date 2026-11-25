"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface Bill {
  orderNumber: string;
  type: string;
  status: string;
  billedAt: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  tipAmount: string;
  totalAmount: string;
  guestName: string | null;
  customer: { name: string; phone: string | null } | null;
  table: { number: string; name: string | null } | null;
  createdBy: { name: string } | null;
  items: { id: string; quantity: number; nameSnapshot: string; lineTotal: string; status: string }[];
  payments: { id: string; method: string; amount: string; reference: string | null }[];
  refunds: { id: string; amount: string; method: string; reason: string | null }[];
}

// Read-only view of one bill for people who can see sales reports but cannot take orders (an accountant opening a
// line of the day book). Staff who run the till open the full bill window instead.
export function BillViewDialog({
  branchId,
  orderId,
  onClose,
}: {
  branchId: string | null;
  orderId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "bill", branchId, orderId],
    queryFn: () => api.get<Bill>(`/reports/bills/${orderId}?branchId=${branchId}`),
    enabled: !!branchId && !!orderId,
    retry: false,
  });
  const money = (v: string) => formatCurrency(Number(v));
  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bill {data?.orderNumber ?? ""}
            {data && <Badge variant="secondary" className="font-normal">{data.status}</Badge>}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load this bill"}</p>
        ) : data ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {data.billedAt ? new Date(data.billedAt).toLocaleString() : "Not billed"} · {data.type.replace("_", " ").toLowerCase()}
              {data.table && ` · table ${data.table.number}`} · {data.guestName ?? data.customer?.name ?? "Walk-in"}
              {data.createdBy && ` · billed by ${data.createdBy.name}`}
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.items.map((i) => (
                <li key={i.id} className="flex justify-between px-3 py-2">
                  <span className={i.status === "CANCELLED" ? "text-muted-foreground line-through" : ""}>{i.quantity}× {i.nameSnapshot}</span>
                  <span className="tabular-nums">{money(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 rounded-lg bg-secondary/40 px-3 py-2 tabular-nums">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(data.subtotal)}</dd></div>
              {Number(data.discountAmount) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{money(data.discountAmount)}</dd></div>}
              {Number(data.taxAmount) > 0 && <div className="flex justify-between"><dt>Tax included</dt><dd>{money(data.taxAmount)}</dd></div>}
              {Number(data.tipAmount) > 0 && <div className="flex justify-between"><dt>Tip</dt><dd>{money(data.tipAmount)}</dd></div>}
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(data.totalAmount)}</dd></div>
            </dl>
            {data.payments.length > 0 && (
              <p className="text-muted-foreground">
                Paid: {data.payments.map((p) => `${p.method} ${money(p.amount)}${p.reference ? ` (${p.reference})` : ""}`).join(" + ")}
              </p>
            )}
            {data.refunds.length > 0 && (
              <p className="text-muted-foreground">
                Refunded: {data.refunds.map((r) => `${money(r.amount)} by ${r.method}${r.reason ? ` — ${r.reason}` : ""}`).join("; ")}
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
