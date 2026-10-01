import { db, client, outlets, users, serviceCategories, services, promos, customers } from "./index";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Outlet
  const outletName = process.env.DEFAULT_OUTLET_NAME || "POS LAUNDRY";
  let [outlet] = await db.select().from(outlets).limit(1);

  if (!outlet) {
    console.log(`Creating default outlet: ${outletName}`);
    [outlet] = await db
      .insert(outlets)
      .values({
        name: outletName,
        address: "Jl. Merdeka No. 88, Kebayoran Baru, Jakarta Selatan",
        phone: "081234567890",
        receiptFooter: "Terima kasih telah mempercayakan pakaian Anda kepada kami!\nBarang yang tidak diambil dalam 30 hari di luar tanggung jawab laundry.",
        timezone: "Asia/Jakarta",
      })
      .returning();
  } else {
    console.log(`Outlet already exists: ${outlet.name} (${outlet.id})`);
  }

  // 2. Default Owner User
  const adminUsername = process.env.DEFAULT_ADMIN_USER || "admin";
  const adminPass = process.env.DEFAULT_ADMIN_PASS || "123456";
  const existingOwner = await db.query.users.findFirst({
    where: eq(users.username, adminUsername),
  });

  if (!existingOwner) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    console.log(`Creating default owner user: ${adminUsername}`);
    await db.insert(users).values({
      outletId: outlet.id,
      username: adminUsername,
      email: "admin@poslaundry.com",
      fullName: "Owner POS Laundry",
      passwordHash,
      role: "owner",
      pin: "1234",
      isActive: true,
    });
  } else {
    console.log(`Owner user already exists: ${adminUsername}`);
  }

  // 3. Default Cashier User
  const existingCashier = await db.query.users.findFirst({
    where: eq(users.username, "kasir"),
  });

  if (!existingCashier) {
    const passwordHash = await bcrypt.hash("123456", 10);
    console.log("Creating default cashier user: kasir");
    await db.insert(users).values({
      outletId: outlet.id,
      username: "kasir",
      email: "kasir@poslaundry.com",
      fullName: "Kasir Toko (Shift 1)",
      passwordHash,
      role: "kasir",
      pin: "0000",
      isActive: true,
    });
  }

  // 4. Categories & Services
  const existingCategories = await db.query.serviceCategories.findMany({
    where: eq(serviceCategories.outletId, outlet.id),
  });

  if (existingCategories.length === 0) {
    console.log("Seeding categories and services...");
    
    // Category 1: Kiloan
    const [catKiloan] = await db.insert(serviceCategories).values({
      outletId: outlet.id,
      name: "Laundry Kiloan",
    }).returning();

    await db.insert(services).values([
      {
        outletId: outlet.id,
        categoryId: catKiloan.id,
        name: "Cuci Kering Setrika (2 Hari)",
        unitType: "kg",
        price: 9000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catKiloan.id,
        name: "Cuci Kering Lipat (2 Hari)",
        unitType: "kg",
        price: 7000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catKiloan.id,
        name: "Cuci Setrika Kilat (1 Hari / 24 Jam)",
        unitType: "kg",
        price: 14000,
        durationHours: 24,
      },
      {
        outletId: outlet.id,
        categoryId: catKiloan.id,
        name: "Cuci Express Super (6 Jam)",
        unitType: "kg",
        price: 20000,
        durationHours: 6,
      },
      {
        outletId: outlet.id,
        categoryId: catKiloan.id,
        name: "Hanya Setrika Rapi",
        unitType: "kg",
        price: 5000,
        durationHours: 24,
      },
    ]);

    // Category 2: Satuan Pakaian
    const [catSatuan] = await db.insert(serviceCategories).values({
      outletId: outlet.id,
      name: "Satuan Pakaian",
    }).returning();

    await db.insert(services).values([
      {
        outletId: outlet.id,
        categoryId: catSatuan.id,
        name: "Kemeja / Blus",
        unitType: "pcs",
        price: 15000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catSatuan.id,
        name: "Jas / Blazer",
        unitType: "pcs",
        price: 35000,
        durationHours: 72,
      },
      {
        outletId: outlet.id,
        categoryId: catSatuan.id,
        name: "Gaun / Dress Pesta",
        unitType: "pcs",
        price: 45000,
        durationHours: 72,
      },
      {
        outletId: outlet.id,
        categoryId: catSatuan.id,
        name: "Jaket Tebal / Parka",
        unitType: "pcs",
        price: 25000,
        durationHours: 48,
      },
    ]);

    // Category 3: Sepatu & Tas
    const [catSepatu] = await db.insert(serviceCategories).values({
      outletId: outlet.id,
      name: "Sepatu & Tas",
    }).returning();

    await db.insert(services).values([
      {
        outletId: outlet.id,
        categoryId: catSepatu.id,
        name: "Cuci Sepatu Sneaker (Deep Clean)",
        unitType: "pcs",
        price: 35000,
        durationHours: 72,
      },
      {
        outletId: outlet.id,
        categoryId: catSepatu.id,
        name: "Cuci Sepatu Kulit / Formal",
        unitType: "pcs",
        price: 50000,
        durationHours: 72,
      },
      {
        outletId: outlet.id,
        categoryId: catSepatu.id,
        name: "Cuci Tas Ransel / Backpack",
        unitType: "pcs",
        price: 30000,
        durationHours: 72,
      },
    ]);

    // Category 4: Bedcover & Linen
    const [catBedcover] = await db.insert(serviceCategories).values({
      outletId: outlet.id,
      name: "Bedcover & Perlengkapan Rumah",
    }).returning();

    await db.insert(services).values([
      {
        outletId: outlet.id,
        categoryId: catBedcover.id,
        name: "Bedcover Single (Kecil)",
        unitType: "pcs",
        price: 25000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catBedcover.id,
        name: "Bedcover King/Queen (Besar)",
        unitType: "pcs",
        price: 35000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catBedcover.id,
        name: "Sprei Set",
        unitType: "pcs",
        price: 18000,
        durationHours: 48,
      },
      {
        outletId: outlet.id,
        categoryId: catBedcover.id,
        name: "Selimut Tebal",
        unitType: "pcs",
        price: 20000,
        durationHours: 48,
      },
    ]);
  }

  // 5. Promos
  const existingPromos = await db.query.promos.findMany({
    where: eq(promos.outletId, outlet.id),
  });

  if (existingPromos.length === 0) {
    console.log("Seeding promos...");
    await db.insert(promos).values([
      {
        outletId: outlet.id,
        name: "Promo Grand Opening 10%",
        type: "persen",
        value: 10,
        minSpend: 30000,
        isActive: true,
      },
      {
        outletId: outlet.id,
        name: "Potongan Hemat Rp 5.000",
        type: "nominal",
        value: 5000,
        minSpend: 50000,
        isActive: true,
      },
    ]);
  }

  // 6. Sample Customers
  const existingCustomers = await db.query.customers.findMany({
    where: eq(customers.outletId, outlet.id),
  });

  if (existingCustomers.length === 0) {
    console.log("Seeding sample customers...");
    await db.insert(customers).values([
      {
        outletId: outlet.id,
        name: "Budi Santoso",
        phone: "6281234567891",
        address: "Jl. Anggrek No. 12, Jakarta",
        note: "Pelanggan langganan kiloan",
      },
      {
        outletId: outlet.id,
        name: "Siti Rahma",
        phone: "6285678901234",
        address: "Jl. Melati Blok C2 No. 5",
        note: "Suka cuci sepatu & bedcover",
      },
    ]);
  }

  console.log("✅ Database seed completed successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
