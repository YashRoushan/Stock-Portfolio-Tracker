import { useEffect, useRef, useState } from "react";

export default function BullBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  const motion = useRef<{resume():void; dispose():void}>();
  const paused = useRef(false);
  const [playing,setPlaying] = useState(false);
  const [fallback,setFallback] = useState(false);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let closed = false;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const setPreference = () => {
      paused.current = preference.matches;
      setPlaying(!paused.current);
      motion.current?.resume();
    };
    setPreference(); preference.addEventListener("change", setPreference);
    import("../art/animateBull").then(({animateBull}) => {
      if (closed || !host.current) return;
      motion.current = animateBull(host.current, paused);
      setReady(true);
    }).catch(() => {
      if (!closed) { setFallback(true); setReady(true); }
    });
    return () => {
      closed = true; preference.removeEventListener("change", setPreference);
      motion.current?.dispose(); motion.current = undefined;
    };
  }, []);
  return <div className="bull-stage">
    <div className="bull-ground" aria-hidden="true" />
    <div className="bull-model" aria-hidden="true" ref={host}>
      {fallback && <div className="bull-strip" style={{animationPlayState: playing ? "running" : "paused"}} />}
      <img src="/charging-bull.webp" width="900" height="533" alt="" />
    </div>
    {ready && <button type="button" className="bull-motion" aria-label={playing ? "Pause bull animation" : "Play bull animation"}
      onClick={() => { paused.current = playing; setPlaying(!playing); motion.current?.resume(); }}>
      {playing ? "Ⅱ" : "▶"}
    </button>}
  </div>;
}
