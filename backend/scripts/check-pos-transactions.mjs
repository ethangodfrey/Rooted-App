import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tx = await prisma.posImportedTransaction.findMany({
  take: 10,
  orderBy: { soldAt: 'desc' },
  include: { lineItems: true },
});
console.log(
  JSON.stringify(
    tx.map((t) => ({
      id: t.id,
      soldAt: t.soldAt,
      netAmount: t.netAmount,
      grossAmount: t.grossAmount,
      lineItems: t.lineItems.map((li) => ({
        name: li.name,
        quantity: li.quantity,
        grossAmount: li.grossAmount,
        productId: li.productId,
      })),
    })),
    null,
    2,
  ),
);
await prisma.$disconnect();
