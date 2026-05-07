import { useCallback, useEffect, useRef, useState } from "react";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

export function useDatePlayer(initialDate?: string) {
  const today = formatDate(new Date());
  const maxDate = addDays(today, -1);
  const minDate = "2012-01-01";

  const [date, setDate] = useState(initialDate ?? addDays(maxDate, -8));
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepDays, setStepDays] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying((p) => !p), []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setDate((prev) => {
          const next = addDays(prev, stepDays);
          if (next > maxDate) {
            // Loop back when exceeding max date
            return minDate;
          }
          return next;
        });
      }, 1200);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, maxDate, minDate, stepDays]);

  return { date, setDate, isPlaying, play, pause, toggle, stepDays, setStepDays };
}
