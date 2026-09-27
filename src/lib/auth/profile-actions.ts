"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const displayName = formData.get("displayName") as string;
  const denomination = formData.get("denomination") as string;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      denomination: denomination || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
