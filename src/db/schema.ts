import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["owner", "kasir"]);
export const unitEnum = pgEnum("unit_type", ["kg", "pcs"]);
export const orderStatusEnum = pgEnum("order_status", [
  "diterima",
  "diproses",
  "selesai",
  "sudah_diambil",
  "dibatalkan",
]);
export const payKindEnum = pgEnum("payment_kind", ["dp", "pelunasan", "refund"]);
export const payMethodEnum = pgEnum("payment_method", ["tunai", "qris"]);
export const discountTypeEnum = pgEnum("discount_type", ["persen", "nominal"]);

// Outlets table
export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  receiptFooter: text("receipt_footer"),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Users table (Owners & Cashiers)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: roleEnum("role").notNull().default("kasir"),
  pin: text("pin"), // Optional 4-6 digit PIN for quick authorization
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_outlet_username_uq").on(t.outletId, t.username),
]);

// Auth Sessions
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // Session token / ID
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customers (Basic CRM)
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(), // normalized to 62xxxxxxxxxx
    address: text("address"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_outlet_phone_uq").on(t.outletId, t.phone),
    index("customers_name_idx").on(t.outletId, t.name),
  ]
);

// Service Categories
export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Services (Kiloan & Satuan)
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => serviceCategories.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  unitType: unitEnum("unit_type").notNull(),
  price: integer("price").notNull(), // Rupiah integer
  durationHours: integer("duration_hours").notNull().default(24),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Promos
export const promos = pgTable("promos", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: discountTypeEnum("type").notNull(),
  value: integer("value").notNull(),
  minSpend: integer("min_spend").default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cashier Shifts
export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  openingCash: integer("opening_cash").notNull(), // kas awal
  closedAt: timestamp("closed_at"),
  countedCash: integer("counted_cash"), // uang fisik laci dihitung
  expectedCash: integer("expected_cash"), // kas sistem di laci
  cashDifference: integer("cash_difference"), // countedCash - expectedCash
  closingNote: text("closing_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Orders
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
    invoiceNo: text("invoice_no").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("diterima"),
    subtotal: integer("subtotal").notNull(),
    promoId: uuid("promo_id").references(() => promos.id, { onDelete: "set null" }),
    promoDiscount: integer("promo_discount").notNull().default(0),
    manualDiscount: integer("manual_discount").notNull().default(0),
    manualDiscountReason: text("manual_discount_reason"),
    total: integer("total").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0), // denormalized sum(payments)
    estimatedDoneAt: timestamp("estimated_done_at"),
    note: text("note"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelReason: text("cancel_reason"),
    isRefunded: boolean("is_refunded").notNull().default(false),
    pickedUpAt: timestamp("picked_up_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_outlet_invoice_uq").on(t.outletId, t.invoiceNo),
    index("orders_outlet_status_idx").on(t.outletId, t.status),
    index("orders_created_at_idx").on(t.outletId, t.createdAt),
  ]
);

// Order Items (Snapshot harga dan nama layanan)
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull(),
  serviceName: text("service_name").notNull(), // snapshot
  unitType: unitEnum("unit_type").notNull(), // snapshot
  unitPrice: integer("unit_price").notNull(), // snapshot
  quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(),
  subtotal: integer("subtotal").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payments
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "restrict" }),
  kind: payKindEnum("kind").notNull(), // dp, pelunasan, refund
  method: payMethodEnum("method").notNull(), // tunai, qris
  amount: integer("amount").notNull(),
  cashReceived: integer("cash_received"), // Uang tunai diterima pelanggan (opsional untuk kembalian)
  changeGiven: integer("change_given"), // Kembalian (opsional)
  reference: text("reference"), // Kode referensi transaksi QRIS
  note: text("note"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Order Status Logs
export const orderStatusLogs = pgTable("order_status_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatusEnum("from_status"),
  toStatus: orderStatusEnum("to_status").notNull(),
  note: text("note"),
  changedBy: uuid("changed_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  outletId: uuid("outlet_id")
    .notNull()
    .references(() => outlets.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Daily Invoice Counter for Atomic sequential format: LDR-YYMMDD-NNNN
export const invoiceCounters = pgTable(
  "invoice_counters",
  {
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(), // e.g. "261001"
    lastSeq: integer("last_seq").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.outletId, t.dateKey] }),
  ]
);

// Relations definitions for easy Drizzle querying
export const outletsRelations = relations(outlets, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  serviceCategories: many(serviceCategories),
  services: many(services),
  promos: many(promos),
  shifts: many(shifts),
  orders: many(orders),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [users.outletId],
    references: [outlets.id],
  }),
  sessions: many(sessions),
  shifts: many(shifts),
  ordersCreated: many(orders, { relationName: "ordersCreated" }),
  paymentsCreated: many(payments),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [customers.outletId],
    references: [outlets.id],
  }),
  orders: many(orders),
}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [serviceCategories.outletId],
    references: [outlets.id],
  }),
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  outlet: one(outlets, {
    fields: [services.outletId],
    references: [outlets.id],
  }),
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [shifts.outletId],
    references: [outlets.id],
  }),
  cashier: one(users, {
    fields: [shifts.cashierId],
    references: [users.id],
  }),
  orders: many(orders),
  payments: many(payments),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [orders.outletId],
    references: [outlets.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  shift: one(shifts, {
    fields: [orders.shiftId],
    references: [shifts.id],
  }),
  creator: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
    relationName: "ordersCreated",
  }),
  promo: one(promos, {
    fields: [orders.promoId],
    references: [promos.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  statusLogs: many(orderStatusLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  shift: one(shifts, {
    fields: [payments.shiftId],
    references: [shifts.id],
  }),
  cashier: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
}));

export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusLogs.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [orderStatusLogs.changedBy],
    references: [users.id],
  }),
}));
