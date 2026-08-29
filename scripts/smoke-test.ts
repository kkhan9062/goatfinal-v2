import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const supplier = await prisma.supplier.create({
    data: { name: '__smoke_test_supplier__' },
  });
  const found = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  console.log('Created + read back:', found);
  await prisma.supplier.delete({ where: { id: supplier.id } });
  console.log('Cleaned up. Connection works end-to-end.');
}

main()
  .catch((e) => {
    console.error('Smoke test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
