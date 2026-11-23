/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await -- hand-built Prisma fakes */
import { OrdersService } from './orders.service';
import { GiftCardsService } from '../gift-cards/gift-cards.service';

function setup(redemptions: { giftCardId: string; amount: number }[] = []) {
  const credits: { giftCardId: string; amount: number }[] = [];
  const giftCards: any = {
    credit: jest.fn(
      async (_tx: any, _branch: string, giftCardId: string, amount: number) => {
        credits.push({ giftCardId, amount });
      },
    ),
  };
  const tx: any = {
    order: { update: jest.fn(async () => ({})) },
    refund: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'ref1' })),
    },
    gatewayRefund: { findMany: jest.fn(async () => []) },
    giftCardRedemption: { findMany: jest.fn(async () => redemptions) },
    pointsLedger: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    giftCard: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma: any = {
    order: {
      findFirst: jest.fn(async () => ({
        id: 'o1',
        status: 'PAID',
        totalAmount: 100,
        customerId: null,
        loyaltyPointsRedeemed: 0,
      })),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const verifactu: any = { recordRefund: jest.fn(async () => ({})) };
  const svc: any = Object.create(OrdersService.prototype);
  svc.prisma = prisma;
  svc.giftCards = giftCards;
  svc.verifactu = verifactu;
  svc.realtime = { emitToBranch: jest.fn() };
  svc.audit = { record: jest.fn(async () => ({})) };
  return { svc, tx, credits };
}

const refund = (svc: any, method: string, amount = 100) =>
  svc.refund('b1', 'o1', 'u1', {
    amount,
    method: method as never,
    reason: 'returned item',
  });

describe('gift card value on refund', () => {
  it('re-credits the redeemed value when the refund goes back to the card', async () => {
    const s = setup([{ giftCardId: 'gc1', amount: 100 }]);
    await refund(s.svc, 'GIFT_CARD');
    expect(s.credits).toEqual([{ giftCardId: 'gc1', amount: 100 }]);
  });

  it('pro-rates partial refunds across every redemption on the order', async () => {
    const s = setup([
      { giftCardId: 'gc1', amount: 60 },
      { giftCardId: 'gc2', amount: 40 },
    ]);
    await refund(s.svc, 'GIFT_CARD', 25);
    expect(s.credits).toEqual([
      { giftCardId: 'gc1', amount: 15 },
      { giftCardId: 'gc2', amount: 10 },
    ]);
  });

  it('does not credit the card for a cash refund', async () => {
    const s = setup([{ giftCardId: 'gc1', amount: 100 }]);
    await refund(s.svc, 'CASH');
    expect(s.credits).toEqual([]);
    expect(s.tx.giftCardRedemption.findMany).not.toHaveBeenCalled();
  });
});

describe('GiftCardsService.credit', () => {
  it('increments the balance atomically and refuses a foreign card', async () => {
    const tx: any = {
      giftCard: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    const service = new GiftCardsService({} as never);
    await service.credit(tx, 'b1', 'gc1', 12.345);
    expect(tx.giftCard.updateMany).toHaveBeenCalledWith({
      where: { id: 'gc1', branchId: 'b1' },
      data: { balance: { increment: 12.35 } },
    });
    tx.giftCard.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.credit(tx, 'b1', 'gcX', 1)).rejects.toThrow(
      /not found for this branch/,
    );
  });
});
