const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestFlow = await prisma.userFlow.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log(JSON.stringify(latestFlow, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
