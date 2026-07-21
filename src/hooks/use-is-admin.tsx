import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * Cached admin-role check. Deduped across components via React Query and
 * invalidated automatically by the root-level auth listener on SIGNED_IN /
 * SIGNED_OUT, so multiple consumers mount without firing parallel requests.
 */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    enabled: !authLoading && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  return {
    isAdmin: !!query.data,
    loading: authLoading || (!!user && query.isLoading),
  };
}
