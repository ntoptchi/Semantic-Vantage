import { useEffect, useState } from "react";
import { fetchFloodLayers } from "../api/flood";
import type { FloodLayer } from "../types/flood";

export function useFloodLayers() {
  const [layers, setLayers] = useState<FloodLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchFloodLayers()
      .then((data) => {
        if (!cancelled) {
          setLayers(data.layers);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load flood layers");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { layers, loading, error };
}
