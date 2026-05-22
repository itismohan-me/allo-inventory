import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const warehouseA = await prisma.warehouse.upsert({
    where: { id: "wh-mumbai" },
    update: {},
    create: {
      id: "wh-mumbai",
      name: "Mumbai Central",
      location: "Mumbai, MH",
    },
  });

  const warehouseB = await prisma.warehouse.upsert({
    where: { id: "wh-delhi" },
    update: {},
    create: {
      id: "wh-delhi",
      name: "Delhi North",
      location: "Delhi, DL",
    },
  });

  const products = [
    {
      id: "prod-001",
      name: "Testosterone Booster (60 caps)",
      sku: "TESTO-60",
      description: "Natural testosterone support with Ashwagandha & Zinc.",
      price: 1299,
      imageUrl: null,
    },
    {
      id: "prod-002",
      name: "Omega-3 Fish Oil (90 softgels)",
      sku: "OMEGA3-90",
      description: "High-potency EPA & DHA for heart and brain health.",
      price: 899,
      imageUrl: null,
    },
    {
      id: "prod-003",
      name: "Vitamin D3 + K2 (120 tabs)",
      sku: "VITD3K2-120",
      description: "Essential duo for bone density and immune support.",
      price: 749,
      imageUrl: null,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }

  const stocks = [
    { productId: "prod-001", warehouseId: warehouseA.id, total: 50 },
    { productId: "prod-001", warehouseId: warehouseB.id, total: 3 },
    { productId: "prod-002", warehouseId: warehouseA.id, total: 100 },
    { productId: "prod-002", warehouseId: warehouseB.id, total: 25 },
    { productId: "prod-003", warehouseId: warehouseA.id, total: 1 }, // tight stock to demo 409
    { productId: "prod-003", warehouseId: warehouseB.id, total: 0 },
  ];

  for (const s of stocks) {
    await prisma.stock.upsert({
      where: {
        productId_warehouseId: {
          productId: s.productId,
          warehouseId: s.warehouseId,
        },
      },
      update: {},
      create: { ...s, reserved: 0 },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
