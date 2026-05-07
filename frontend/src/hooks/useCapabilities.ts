import { useEffect, useState } from "react";
import { fetchCapabilities } from "../api/ndvi";
import type { NDVILayer } from "../types/ndvi";

export function useCapabilities() {
  const [layers, setLayers] = useState<NDVILayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCapabilities()
      .then((data) => {
        if (!cancelled) {
          setLayers(data.layers);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { layers, loading, error };
}
