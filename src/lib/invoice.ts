import { db, invoiceCounters } from "../db";
import { sql } from "drizzle-orm";

export function getDateKey(date = new Date()): string {
  // Format to Asia/Jakarta (UTC+7)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "26";

  return `${year}${month}${day}`;
}

export async function generateInvoiceNumber(
  outletId: string,
  txClient?: any
): Promise<string> {
  const runner = txClient || db;
  const dateKey = getDateKey();

  // Atomically increment counter for this outlet and date
  const result = await runner
    .insert(invoiceCounters)
    .values({
      outletId,
      dateKey,
      lastSeq: 1,
    })
    .onConflictDoUpdate({
      target: [invoiceCounters.outletId, invoiceCounters.dateKey],
      set: {
        lastSeq: sql`${invoiceCounters.lastSeq} + 1`,
      },
    })
    .returning({ lastSeq: invoiceCounters.lastSeq });

  const seq = result[0]?.lastSeq || 1;
  const formattedSeq = String(seq).padStart(4, "0");

  return `LDR-${dateKey}-${formattedSeq}`;
}
