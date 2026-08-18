import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  // Use the same SQLite adapter setup as in our application service
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting database seeding...');

  // 1. Rename existing shops (e.g. "Чудо" -> "Колумб" and legacy long names)
  const nameMappings: Record<string, string> = {
    Чудо: 'Колумб',
    Университетская: 'Универ',
    Никольский: 'Николь',
    Французский: 'Франц',
  };

  for (const [oldName, newName] of Object.entries(nameMappings)) {
    const shopToRename = await prisma.shop.findFirst({
      where: { name: oldName },
    });

    if (shopToRename) {
      await prisma.shop.update({
        where: { id: shopToRename.id },
        data: { name: newName },
      });
      console.log(`🔄 Renamed shop "${oldName}" to "${newName}"`);
    }
  }

  // 2. Completely delete shop "Свобода" and its associated expenses
  const svobodaShops = await prisma.shop.findMany({
    where: { name: 'Свобода' },
  });

  for (const shop of svobodaShops) {
    const deletedExpenses = await prisma.shopExpenses.deleteMany({
      where: { shopId: shop.id },
    });
    console.log(`🗑️ Deleted ${deletedExpenses.count} expenses for shop: ${shop.name}`);

    await prisma.shop.delete({
      where: { id: shop.id },
    });
    console.log(`🗑️ Deleted shop: ${shop.name}`);
  }

  // 3. Ensure target default shops exist
  const defaultShops = ['Колумб', 'Универ', 'Изюм', 'Николь', 'Франц'];

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
