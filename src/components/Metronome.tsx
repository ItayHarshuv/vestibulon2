import { useEffect, useRef, useState } from "react";

interface MetronomeProps {
  bpm: number;
  isRunning: boolean;
  onBpmChange: (nextBpm: number) => void;
}

function playClick(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(880, context.currentTime);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.08);
}

export function Metronome({ bpm, isRunning, onBpmChange }: MetronomeProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const [sliderValue, setSliderValue] = useState(bpm);

  useEffect(() => {
    setSliderValue(bpm);
  }, [bpm]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const context = audioContextRef.current;
    void context.resume();

    const millisecondsPerBeat = Math.max(1, Math.round(60000 / bpm));
    const tick = () => {
      playClick(context);
    };

    tick();
    intervalRef.current = window.setInterval(tick, millisecondsPerBeat);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [bpm, isRunning]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return (
    <section className="mt-8">
      <p className="text-center text-2xl font-semibold text-gray-900">
        מהירות מטרונות: {sliderValue} פעימות לדקה
      </p>

      <input
        type="range"
        min={30}
        max={240}
        value={sliderValue}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          setSliderValue(nextValue);

          if (debounceTimeoutRef.current !== null) {
            window.clearTimeout(debounceTimeoutRef.current);
          }

          debounceTimeoutRef.current = window.setTimeout(() => {
            onBpmChange(nextValue);
          }, 300);
        }}
        className="mt-4 h-2 w-full cursor-pointer accent-blue-500"
      />
    </section>
  );
}
