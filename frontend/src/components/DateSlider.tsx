import { useCallback } from "react";

interface DateSliderProps {
  date: string;
  onDateChange: (date: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  stepDays: number;
  onChangeStepDays: (days: number) => void;
}

function dateToNum(d: string): number {
  return new Date(d + "T00:00:00Z").getTime();
}

function numToDate(n: number): string {
  return new Date(n).toISOString().slice(0, 10);
}

const MIN_DATE = "2012-01-01";
const MAX_DATE_OFFSET = -1;

function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + MAX_DATE_OFFSET);
  return d.toISOString().slice(0, 10);
}

const SPEED_OPTIONS = [1, 3, 7, 14];

export function DateSlider({
  date,
  onDateChange,
  isPlaying,
  onTogglePlay,
  stepDays,
  onChangeStepDays,
}: DateSliderProps) {
  const maxDate = getMaxDate();

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateChange(numToDate(Number(e.target.value)));
    },
    [onDateChange]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateChange(e.target.value);
    },
    [onDateChange]
  );

  return (
    <div className="control-card date-slider">
      <label className="control-label">Date</label>
      <div className="date-speed-row">
        {SPEED_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            className={`btn btn-icon speed-btn ${stepDays === d ? "btn-active" : ""}`}
            onClick={() => onChangeStepDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>
      <div className="date-slider-row">
        <button
          className="btn btn-icon"
          onClick={onTogglePlay}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min={dateToNum(MIN_DATE)}
          max={dateToNum(maxDate)}
          step={86400000}
          value={dateToNum(date)}
          onChange={handleSlider}
          className="slider"
        />
        <input
          type="date"
          value={date}
          min={MIN_DATE}
          max={maxDate}
          onChange={handleInput}
          className="date-input"
        />
      </div>
      <div className="date-label">{date}</div>
    </div>
  );
}
