import type { APIRoute } from "astro";
import { db, outlets, users } from "../../../db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../../lib/auth";

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
    const { name, address, phone, receiptFooter, ownerPin, newPassword } = body;

    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nama usaha laundry wajib diisi." }), { status: 400 });
    }

    // Update outlet profile
    const [updatedOutlet] = await db
      .update(outlets)
      .set({
        name: name.trim(),
        address: address ? address.trim() : null,
        phone: phone ? phone.trim() : null,
        receiptFooter: receiptFooter ? receiptFooter.trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(outlets.id, outlet.id))
      .returning();

    // Update owner user PIN or password if provided
    const userUpdate: any = {
      updatedAt: new Date(),
    };
    if (ownerPin) {
      userUpdate.pin = String(ownerPin).trim();
    }
    if (newPassword && newPassword.trim().length >= 5) {
      userUpdate.passwordHash = await hashPassword(newPassword.trim());
    }

    await db.update(users).set(userUpdate).where(eq(users.id, user.id));

    return new Response(
      JSON.stringify({
        success: true,
        outlet: updatedOutlet,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Owner settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal memperbarui pengaturan usaha" }), { status: 500 });
  }
};
