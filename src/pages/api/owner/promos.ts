import type { APIRoute } from "astro";
import { db, promos } from "../../../db";
import { eq, and } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  const outlet = locals.outlet;
  if (!user || !outlet || user.role !== "owner") {
    return new Response(JSON.stringify({ error: "Unauthorized. Owner only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { action, id, name, type, value, minSpend, isActive } = body;

    if (action === "create") {
      if (!name || !type || value === undefined) {
        return new Response(JSON.stringify({ error: "Data promo tidak lengkap" }), { status: 400 });
      }

      const [promo] = await db
        .insert(promos)
        .values({
          outletId: outlet.id,
          name: String(name).trim(),
          type: type === "persen" ? "persen" : "nominal",
          value: Math.round(Number(value)),
          minSpend: minSpend ? Math.round(Number(minSpend)) : 0,
          isActive: true,
        })
        .returning();

      return new Response(JSON.stringify({ success: true, promo }), { status: 201 });
    }

    if (action === "update") {
      const [promo] = await db
        .update(promos)
        .set({
          name: name ? String(name).trim() : undefined,
          type: type ? (type === "persen" ? "persen" : "nominal") : undefined,
          value: value !== undefined ? Math.round(Number(value)) : undefined,
          minSpend: minSpend !== undefined ? Math.round(Number(minSpend)) : undefined,
          isActive: typeof isActive === "boolean" ? isActive : undefined,
        })
        .where(and(eq(promos.id, id), eq(promos.outletId, outlet.id)))
        .returning();

      return new Response(JSON.stringify({ success: true, promo }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Aksi tidak dikenali" }), { status: 400 });
  } catch (err: any) {
    console.error("Owner promos error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan promo" }), { status: 500 });
  }
};
