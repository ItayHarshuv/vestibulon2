import { useEffect, useMemo, useState } from "react";

interface WorkoutStopwatchProps {
  startTimestampMs: number;
  prefixText: string;
}

function formatElapsedDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function WorkoutStopwatch({ startTimestampMs, prefixText }: WorkoutStopwatchProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const elapsedDisplay = useMemo(() => {
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startTimestampMs) / 1000));
    return formatElapsedDuration(elapsedSeconds);
  }, [nowMs, startTimestampMs]);

  return (
    <p className="text-center text-2xl font-semibold text-gray-900">
      {prefixText} {elapsedDisplay} דקות
    </p>
  );
}
