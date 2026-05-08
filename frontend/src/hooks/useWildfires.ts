import { useEffect, useState, useCallback } from "react";
import { fetchRecentFires } from "../api/fires";
import type { FireDetection } from "../types/fire";

interface UseWildfiresOptions {
  enabled: boolean;
  source?: string;
  days?: number;
  limit?: number;
}

export function useWildfires({
  enabled,
  source = "all",
  days = 3,
  limit = 200,
}: UseWildfiresOptions) {
  const [fires, setFires] = useState<FireDetection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>("");

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecentFires({ source, days, limit });
      setFires(data.fires);
      setSourceLabel(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fires");
      setFires([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, source, days, limit]);

  useEffect(() => {
    if (enabled) {
      refetch();
    } else {
      setFires([]);
      setError(null);
    }
  }, [enabled, refetch]);

  return { fires, loading, error, sourceLabel, refetch };
}
