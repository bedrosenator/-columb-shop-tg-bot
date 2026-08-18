import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
  // Use the same SQLite adapter setup as in our application service
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting database seeding...');

  // Target list of active shops requested:
  const targetShops = ['Франц', 'Николь', 'Соборная', 'Поворотка'];

  // 1. Map legacy and alternative names to target names
  const nameMappings: Record<string, string> = {
    Французский: 'Франц',
    Никольский: 'Николь',
    Изюм: 'Соборная',
    'Ізюм Соборна': 'Соборная',
    'Изюм Соборная': 'Соборная',
    Чудо: 'Соборная',
  };

  for (const [oldName, newName] of Object.entries(nameMappings)) {
    const shopsToRename = await prisma.shop.findMany({
      where: { name: oldName },
    });

    for (const shopToRename of shopsToRename) {
      await prisma.shop.update({
        where: { id: shopToRename.id },
        data: { name: newName },
      });
      console.log(`🔄 Renamed shop "${oldName}" to "${newName}"`);
    }
  }

  // 2. Remove all shops (and their associated expenses) that are not in the target list
  const shopsToDelete = await prisma.shop.findMany({
    where: {
      name: {
        notIn: targetShops,
      },
    },
  });

  for (const shop of shopsToDelete) {
    const deletedExpenses = await prisma.shopExpenses.deleteMany({
      where: { shopId: shop.id },
    });
    console.log(`🗑️ Deleted ${deletedExpenses.count} expenses for shop: "${shop.name}"`);

    await prisma.shop.delete({
      where: { id: shop.id },
    });
    console.log(`🗑️ Deleted shop: "${shop.name}"`);
  }

  // 3. Ensure all target shops exist
  for (const name of targetShops) {
    const existing = await prisma.shop.findFirst({
      where: { name },
    });

    if (!existing) {
      await prisma.shop.create({
        data: { name },
      });
      console.log(`🏪 Created shop: "${name}"`);
    } else {
      console.log(`🏪 Shop already exists: "${name}"`);
    }
  }

  await prisma.$disconnect();
  console.log('✅ Seeding completed successfully.');
}

main().catch((e) => {
  console.error('❌ Error during seeding:', e);
  process.exit(1);
});
