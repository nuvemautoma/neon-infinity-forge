import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpdateSchema = z.object({
  userId: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  password: z.string().min(4).max(72).optional(),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId: callerId } = context;
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const authPatch: { email?: string; password?: string } = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;

    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, authPatch);
      if (error) throw new Error(error.message);
      // Invalida sessões ativas do usuário para forçar novo login com as credenciais atualizadas
      try { await supabaseAdmin.auth.admin.signOut(data.userId); } catch (_) { /* noop */ }
    }

    const profilePatch: {
      full_name?: string;
      email?: string;
      must_change_password?: boolean;
    } = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.email) profilePatch.email = data.email;
    if (data.password) profilePatch.must_change_password = false;

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profilePatch)
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
