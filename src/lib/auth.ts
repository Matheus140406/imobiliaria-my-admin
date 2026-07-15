import { createClient } from "@/lib/supabase-db/server";
import type { Tables } from "@/lib/supabase-db/types";

export async function getCorretorAtual(): Promise<Tables<"corretores"> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("corretores")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}
