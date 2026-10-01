import type { APIRoute } from "astro";
import { db, customers } from "../../../db";
import { eq, and, or, ilike } from "drizzle-orm";
import { normalizePhone } from "../../../lib/format";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  try {
    if (!q) {
      const all = await db.query.customers.findMany({
        where: eq(customers.outletId, user.outletId),
        limit: 10,
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      });
      return new Response(JSON.stringify({ customers: all }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const digitsOnly = q.replace(/\D/g, "");

    // Search conditions
    const searchConditions = [
      ilike(customers.name, `%${q}%`),
    ];

    // Only search phone if user actually typed digits (at least 3 numbers)
    if (digitsOnly.length >= 3) {
      searchConditions.push(ilike(customers.phone, `%${digitsOnly}%`));
      const normPhone = normalizePhone(q);
      if (normPhone && normPhone.length >= 5) {
        searchConditions.push(ilike(customers.phone, `%${normPhone}%`));
      }
    }

    const matches = await db.query.customers.findMany({
      where: and(
        eq(customers.outletId, user.outletId),
        or(...searchConditions)
      ),
      limit: 15,
      orderBy: (c, { asc }) => [asc(c.name)],
    });

    return new Response(JSON.stringify({ customers: matches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Search customers error:", err);
    return new Response(JSON.stringify({ error: "Gagal mencari pelanggan" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
