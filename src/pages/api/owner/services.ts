import type { APIRoute } from "astro";
import { db, serviceCategories, services } from "../../../db";
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
    const { action } = body;

    if (action === "create_category") {
      const name = String(body.name || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ error: "Nama kategori wajib diisi" }), { status: 400 });
      }

      const [cat] = await db
        .insert(serviceCategories)
        .values({
          outletId: outlet.id,
          name,
        })
        .returning();

      return new Response(JSON.stringify({ success: true, category: cat }), { status: 201 });
    }

    if (action === "update_category") {
      const { id, name, isActive } = body;
      const [cat] = await db
        .update(serviceCategories)
        .set({
          name: name ? String(name).trim() : undefined,
          isActive: typeof isActive === "boolean" ? isActive : undefined,
        })
        .where(and(eq(serviceCategories.id, id), eq(serviceCategories.outletId, outlet.id)))
        .returning();

      return new Response(JSON.stringify({ success: true, category: cat }), { status: 200 });
    }

    if (action === "create_service") {
      const { categoryId, name, unitType, price, durationHours } = body;
      if (!categoryId || !name || !unitType || price === undefined) {
        return new Response(JSON.stringify({ error: "Data layanan tidak lengkap" }), { status: 400 });
      }

      const [service] = await db
        .insert(services)
        .values({
          outletId: outlet.id,
          categoryId,
          name: String(name).trim(),
          unitType: unitType === "kg" ? "kg" : "pcs",
          price: Math.round(Number(price)),
          durationHours: Math.max(1, Math.round(Number(durationHours) || 24)),
          isActive: true,
        })
        .returning();

      return new Response(JSON.stringify({ success: true, service }), { status: 201 });
    }

    if (action === "update_service") {
      const { id, categoryId, name, unitType, price, durationHours, isActive } = body;
      const [service] = await db
        .update(services)
        .set({
          categoryId: categoryId || undefined,
          name: name ? String(name).trim() : undefined,
          unitType: unitType ? (unitType === "kg" ? "kg" : "pcs") : undefined,
          price: price !== undefined ? Math.round(Number(price)) : undefined,
          durationHours: durationHours ? Math.round(Number(durationHours)) : undefined,
          isActive: typeof isActive === "boolean" ? isActive : undefined,
        })
        .where(and(eq(services.id, id), eq(services.outletId, outlet.id)))
        .returning();

      return new Response(JSON.stringify({ success: true, service }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Aksi tidak dikenali" }), { status: 400 });
  } catch (err: any) {
    console.error("Owner services error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan perubahan layanan" }), { status: 500 });
  }
};
