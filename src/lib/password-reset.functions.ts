import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ResetSchema = z.object({
  email: z.string().email().max(255),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  newPassword: z.string().min(4).max(72),
});

export const resetPasswordWithPurchase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ResetSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();

    if (data.newPassword === "0000") {
      throw new Error("A nova senha não pode ser 0000");
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, purchase_date")
      .ilike("email", email)
      .maybeSingle();

    if (error) throw new Error("Erro ao consultar perfil");
    if (!profile) throw new Error("Email não encontrado");
    if (!profile.purchase_date) throw new Error("Sem data de compra registrada para este email");
    if (profile.purchase_date !== data.purchaseDate) throw new Error("Data da compra não confere");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.newPassword,
    });
    if (updErr) throw new Error("Falha ao atualizar senha: " + updErr.message);

    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", profile.id);

    return { success: true };
  });
