async function runTests() {
  const BASE_URL = "http://localhost:4321";
  console.log("🚀 Starting End-to-End System Integration Test...");

  let cookieHeader = "";

  // Helper for requests
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      // Extract cookie name and value
      const match = setCookie.match(/pos_laundry_session=[^;]+/);
      if (match) cookieHeader = match[0];
    }
    return res;
  }

  // TEST 1: GET /login
  console.log("\n--- TEST 1: Login Page ---");
  const loginPageRes = await request("/login");
  console.log("GET /login status:", loginPageRes.status);
  if (loginPageRes.status !== 200) throw new Error("GET /login failed");
  console.log("✅ Login page renders successfully (200 OK)");

  // TEST 2: POST /api/auth/login (Owner credentials)
  console.log("\n--- TEST 2: Authentication ---");
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernameOrEmail: "admin", password: "123456" }),
  });
  console.log("POST /api/auth/login status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login response:", loginData);
  if (!loginData.success || !cookieHeader) throw new Error("Login failed or no cookie received");
  console.log("✅ Authenticated successfully with session cookie!");

  // TEST 3: GET /shifts & Active Shift
  console.log("\n--- TEST 3: Shift Management ---");
  const currentShiftRes = await request("/api/shifts/current");
  const currentShiftData = await currentShiftRes.json();
  console.log("Current shift status:", currentShiftData);

  let shiftId = currentShiftData.activeShift?.id;
  if (!shiftId) {
    console.log("Opening new shift with kas awal Rp 100.000...");
    const openRes = await request("/api/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingCash: 100000 }),
    });
    const openData = await openRes.json();
    console.log("Open shift result:", openData);
    shiftId = openData.shift.id;
  }
  console.log("✅ Active shift ID:", shiftId);

  // TEST 4: Customer Search & Create
  console.log("\n--- TEST 4: Customer CRM ---");
  const searchCustRes = await request("/api/customers/search?q=Budi");
  const searchCustData = await searchCustRes.json();
  console.log(`Found ${searchCustData.customers.length} customer(s) for query 'Budi'`);

  const createCustRes = await request("/api/customers/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ibu Megawati",
      phone: "081399881122",
      address: "Jl. Tebet Barat No. 15",
      note: "Langganan cuci sprei & bedcover",
    }),
  });
  const createCustData = await createCustRes.json();
  const customerId = createCustData.customer.id;
  console.log("Customer ID created/reused:", customerId, "Phone:", createCustData.customer.phone);
  console.log("✅ Customer CRM test passed!");

  // TEST 5: Create Multi-item Order (FR-ORD-01 to FR-ORD-07)
  console.log("\n--- TEST 5: Order Creation (Kiloan decimal + Satuan pcs) ---");
  // Fetch services to get real service IDs
  const posPageRes = await request("/pos");
  if (posPageRes.status !== 200) throw new Error("GET /pos failed");

  // Fetch categories & services directly from owner services endpoint or query
  const createOrderRes = await request("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      items: [
        {
          serviceId: (await getFirstServiceByUnit("kg")).id,
          quantity: 2.75, // Decimal kiloan
          note: "Baju putih tolong pisahkan",
        },
        {
          serviceId: (await getFirstServiceByUnit("pcs")).id,
          quantity: 1, // Integer pcs
          note: "Sepatu kanvas",
        },
      ],
      paymentAmount: 20000, // DP
      paymentMethod: "tunai",
      cashReceived: 50000,
      note: "Pengerjaan reguler",
    }),
  });

  const orderData = await createOrderRes.json();
  if (!orderData.success) {
    console.error("Create order error:", orderData);
    throw new Error("Create order failed: " + orderData.error);
  }

  const order = orderData.order;
  console.log("✅ Created Invoice:", order.invoiceNo);
  console.log("Total:", order.total, "Paid (DP):", order.paidAmount, "Subtotal:", order.subtotal);
  if (!order.invoiceNo.startsWith("LDR-")) throw new Error("Invoice format incorrect!");
  if (order.paidAmount !== 20000) throw new Error("DP amount incorrect!");

  // TEST 6: Status Progression & Settlement (FR-TRK-01 to FR-TRK-03 & FR-PAY-05)
  console.log("\n--- TEST 6: Status Progression ---");
  // Step 1: Diterima -> Diproses
  const toDiprosesRes = await request("/api/orders/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, newStatus: "diproses" }),
  });
  const toDiprosesData = await toDiprosesRes.json();
  console.log("Status -> Diproses:", toDiprosesData.success);

  // Step 2: Diproses -> Selesai
  const toSelesaiRes = await request("/api/orders/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, newStatus: "selesai" }),
  });
  const toSelesaiData = await toSelesaiRes.json();
  console.log("Status -> Selesai:", toSelesaiData.success);

  // Step 3: Selesai -> Sudah Diambil with Settlement (Pelunasan)
  const remaining = order.total - order.paidAmount;
  console.log(`Settling remaining balance of Rp ${remaining}...`);
  const toAmbilRes = await request("/api/orders/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order.id,
      newStatus: "sudah_diambil",
      paymentAmount: remaining,
      paymentMethod: "tunai",
      cashReceived: remaining,
    }),
  });
  const toAmbilData = await toAmbilRes.json();
  console.log("Status -> Sudah Diambil (Lunas):", toAmbilData.success, "New paidAmount:", toAmbilData.order.paidAmount);
  if (toAmbilData.order.paidAmount !== toAmbilData.order.total) {
    throw new Error("Order was not fully settled!");
  }
  console.log("✅ Order lifecycle test passed!");

  // TEST 7: Order Cancellation Test (FR-CAN-01 to FR-CAN-04)
  console.log("\n--- TEST 7: Order Cancellation & Refund ---");
  const order2Res = await request("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId,
      items: [
        {
          serviceId: (await getFirstServiceByUnit("kg")).id,
          quantity: 3,
        },
      ],
      paymentAmount: 15000,
      paymentMethod: "tunai",
    }),
  });
  const order2 = (await order2Res.json()).order;
  console.log("Order 2 created for cancellation:", order2.invoiceNo);

  const cancelRes = await request("/api/orders/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order2.id,
      reason: "Pelanggan salah antar cucian",
      refundDecision: "refund",
      refundMethod: "tunai",
    }),
  });
  const cancelData = await cancelRes.json();
  console.log("Cancel result:", cancelData);
  if (!cancelData.success) throw new Error("Cancel order failed");
  console.log("✅ Cancellation and refund test passed!");

  // TEST 8: Export CSV (FR-RPT-04)
  console.log("\n--- TEST 8: CSV Reports Export ---");
  const csvDailyRes = await request("/api/owner/export-csv?type=daily");
  const csvDailyText = await csvDailyRes.text();
  console.log("Daily CSV Header:", csvDailyText.split("\n")[0]);
  if (!csvDailyText.includes("No Invoice")) throw new Error("Daily CSV export invalid");

  const csvReceivablesRes = await request("/api/owner/export-csv?type=receivables");
  const csvReceivablesText = await csvReceivablesRes.text();
  console.log("Receivables CSV Header:", csvReceivablesText.split("\n")[0]);
  if (!csvReceivablesText.includes("No Invoice")) throw new Error("Receivables CSV export invalid");
  console.log("✅ CSV Export test passed!");

  // TEST 9: Shift Closing (FR-SHF-02, FR-SHF-03)
  console.log("\n--- TEST 9: Shift Closing ---");
  const shiftStatsRes = await request("/api/shifts/current");
  const shiftStats = (await shiftStatsRes.json()).activeShift;
  console.log("Closing shift. Expected cash in drawer:", shiftStats.expectedCash);

  const closeRes = await request("/api/shifts/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countedCash: shiftStats.expectedCash,
      closingNote: "Tutup shift lancar, fisik laci pas.",
    }),
  });
  const closeData = await closeRes.json();
  console.log("Shift closed summary:", closeData.summary);
  if (!closeData.success || closeData.summary.cashDifference !== 0) {
    throw new Error("Shift closing difference failed");
  }
  console.log("✅ Shift closing test passed!");

  console.log("\n🎉 ALL 9 END-TO-END INTEGRATION TESTS PASSED PERFECTLY! 🎉\n");
}

async function getFirstServiceByUnit(unitType) {
  const { db, services } = await import("../src/db/index.ts");
  const { eq } = await import("drizzle-orm");
  const found = await db.query.services.findFirst({
    where: eq(services.unitType, unitType),
  });
  return found;
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
