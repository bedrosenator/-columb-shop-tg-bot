import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  // Use the same SQLite adapter setup as in our application service
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting database seeding...');

  const defaultShops = ['Франц', 'Николь', 'Соборная', 'Поворотка'];

  for (const name of defaultShops) {
    const existing = await prisma.shop.findFirst({
      where: { name },
    });

    if (!existing) {
      await prisma.shop.create({
        data: { name },
      });
      console.log(`🏪 Created shop: ${name}`);
    } else {
      console.log(`🏪 Shop already exists: ${name}`);
    }
  }

  await prisma.$disconnect();
  console.log('✅ Seeding completed successfully.');
}

main().catch((e) => {
  console.error('❌ Error during seeding:', e);
  process.exit(1);
});
