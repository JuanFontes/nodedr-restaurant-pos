import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { round2 } from '../../common/money';
import { OrdersService } from './orders.service';

export type DuesStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OUTSTANDING';

export interface DuesFilters {
  status?: DuesStatus;
  customerId?: string;
  from?: Date;
  to?: Date;
}

export interface DueRow {
  orderId: string;
  orderNumber: string;
  type: string;
  createdAt: Date;
  customer: { id: string; name: string | null; phone: string | null };
  total: number;
  paid: number;
  balance: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payments: { id: string; method: string; amount: number; at: Date }[];
}

// An open bill left with a named customer who owes money. Unpaid and part-paid
// bills stay OPEN (the existing checkout records each payment against the bill,
// idempotently, and never closes a short one), so the ledger is a read-only view
// over those orders: nothing here moves money or changes a bill.
@Injectable()
export class OrdersDuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async list(branchId: string, f: DuesFilters = {}) {
    const wantPaid = f.status === 'PAID';
    const rows = (await this.prisma.order.findMany({
      where: {
        branchId,
        customerId: f.customerId ?? { not: null },
        status: wantPaid ? 'PAID' : 'OPEN',
        ...(f.from || f.to ? { createdAt: { gte: f.from, lte: f.to } } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        payments: {
          select: { id: true, method: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      // Scan all matching orders: totals and customer aggregates must cover
      // every due. Only the returned `rows` array is sliced at the end.
      orderBy: { createdAt: 'asc' },
    })) as Array<{
      id: string;
      orderNumber: string;
      type: string;
      createdAt: Date;
      totalAmount: unknown;
      customer: {
        id: string;
        name: string | null;
        phone: string | null;
      } | null;
      payments: Array<{
        id: string;
        method: string;
        amount: unknown;
        createdAt: Date;
      }>;
    }>;

    // Bill previews hit the pricing engine; run them concurrently instead of
    // one sequential await per order. An order cancelled mid-scan is skipped.
    const previews = new Map<
      string,
      Awaited<ReturnType<OrdersService['previewBill']>> | null
    >();
    if (!wantPaid) {
      await Promise.all(
        rows.map(async (o) => {
          try {
            const view = await this.orders.previewBill(branchId, o.id, {});
            previews.set(o.id, view);
          } catch (err) {
            // Only an order that vanished or was cancelled can be skipped;
            // any other failure must fail the request, not understate dues.
            if (
              err instanceof NotFoundException ||
              (err instanceof BadRequestException &&
                /cancel/i.test(err.message))
            ) {
              previews.set(o.id, null);
              return;
            }
            throw err;
          }
        }),
      );
    }
    const out: DueRow[] = [];
    for (const o of rows) {
      if (!o.customer) continue;
      if (!wantPaid && !previews.get(o.id)) continue;
      const payments = o.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount),
        at: p.createdAt,
      }));
      let total: number;
      let paid: number;
      if (wantPaid) {
        total = Number(o.totalAmount);
        paid = round2(payments.reduce((s, p) => s + p.amount, 0));
      } else {
        // The exact bill as it would settle now (tax, discounts, tip), not the stored subtotal.
        const view = previews.get(o.id)!;
        total = view.totalDue;
        paid = view.amountPaid;
      }
      const balance = wantPaid ? 0 : Math.max(round2(total - paid), 0);
      if (!wantPaid && balance <= 0.004) continue;
      const status = wantPaid ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
      if (f.status === 'UNPAID' && status !== 'UNPAID') continue;
      if (f.status === 'PARTIAL' && status !== 'PARTIAL') continue;
      out.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        createdAt: o.createdAt,
        customer: o.customer,
        total,
        paid,
        balance,
        status,
        payments,
      });
    }

    const byCustomer = new Map<
      string,
      {
        customerId: string;
        name: string | null;
        phone: string | null;
        bills: number;
        owed: number;
        oldest: Date;
      }
    >();
    for (const r of out) {
      if (r.balance <= 0) continue;
      const c = byCustomer.get(r.customer.id) ?? {
        customerId: r.customer.id,
        name: r.customer.name,
        phone: r.customer.phone,
        bills: 0,
        owed: 0,
        oldest: r.createdAt,
      };
      c.bills += 1;
      c.owed = round2(c.owed + r.balance);
      if (r.createdAt < c.oldest) c.oldest = r.createdAt;
      byCustomer.set(r.customer.id, c);
    }
    return {
      // Aggregates cover every matching order; only the detail list is capped.
      rows: out.slice(0, 5000),
      totalOutstanding: round2(out.reduce((s, r) => s + r.balance, 0)),
      totalCount: out.length,
      customers: [...byCustomer.values()].sort((a, b) => b.owed - a.owed),
    };
  }
}
