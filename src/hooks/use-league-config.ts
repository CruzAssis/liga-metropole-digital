import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicLeagueConfig, type PublicLeagueConfig } from "@/lib/league-config.functions";

let cache: PublicLeagueConfig | null | undefined;
let inflight: Promise<PublicLeagueConfig | null> | null = null;
const listeners = new Set<(v: PublicLeagueConfig | null | undefined) => void>();

export function useLeagueConfig() {
  const fetcher = useServerFn(getPublicLeagueConfig);
  const [cfg, setCfg] = useState<PublicLeagueConfig | null | undefined>(cache);

  useEffect(() => {
    listeners.add(setCfg);
    if (cache === undefined) {
      if (!inflight) {
        inflight = fetcher()
          .then((v) => {
            cache = v ?? null;
            listeners.forEach((l) => l(cache));
            return cache;
          })
          .catch(() => {
            cache = null;
            listeners.forEach((l) => l(cache));
            return null;
          })
          .finally(() => {
            inflight = null;
          });
      }
    }
    return () => {
      listeners.delete(setCfg);
    };
  }, [fetcher]);

  return cfg;
}
