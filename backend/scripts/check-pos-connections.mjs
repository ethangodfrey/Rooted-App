import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.posConnection.findMany({
  where: { provider: 'SQUARE' },
  orderBy: { updatedAt: 'desc' },
  take: 5,
  select: {
    id: true,
    status: true,
    errorMessage: true,
    oauthState: true,
    metadata: true,
    updatedAt: true,
  },
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
