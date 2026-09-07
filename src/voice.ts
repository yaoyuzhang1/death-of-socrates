import { useEffect, useRef, useState } from "react";
import type { Line } from "./model.ts";
export const asset = (path: string) => import.meta.env.BASE_URL + path;
type Clip = { speaker: string; text: string; file: string };
type Status = "idle" | "playing" | "paused" | "blocked" | "unavailable" | "finished";
export function useVoice(lines: Line[], scope: string, panelOpen: boolean) {
  const player = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<string, string>());
  const queue = useRef<Line[]>([]);
  const cursor = useRef(0);
  const generation = useRef(0);
  const resumeAfterPanel = useRef(false);
  const enabledRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("socrates-voice") !== "off";
    } catch {
      return true;
    }
  });
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(-1);
  enabledRef.current = enabled;
  function stop() {
    generation.current++;
    const a = player.current;
    if (a) {
      a.pause();
      a.onended = null;
    }
    setActive(-1);
  }
  function playAt(index: number) {
    const line = queue.current[index];
    if (!line) {
      setStatus("finished");
      setActive(-1);
      return;
    }
    const file = clips.current.get(line.speaker + "\n" + line.text);
    if (!file) {
      setStatus("unavailable");
      setActive(-1);
      return;
    }
    const a = player.current!;
    const ticket = ++generation.current;
    cursor.current = index;
    a.src = asset("voice/" + file);
    a.playbackRate = 1;
    a.onended = () => {
      if (ticket === generation.current && enabledRef.current) playAt(index + 1);
    };
    a.onerror = () => {
      if (ticket === generation.current) {
        setStatus("unavailable");
        setActive(-1);
      }
    };
    void a
      .play()
      .then(() => {
        if (ticket === generation.current) {
          setStatus("playing");
          setActive(index);
        }
      })
      .catch(() => {
        if (ticket === generation.current) {
          setStatus("blocked");
          setActive(-1);
        }
      });
  }
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    player.current = a;
    const abort = new AbortController();
    fetch(asset("voice-manifest.json"), { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Clip[]) => {
        clips.current = new Map(data.map((c) => [c.speaker + "\n" + c.text, c.file]));
        setReady(true);
      })
      .catch(() => {});
    return () => {
      abort.abort();
      generation.current++;
      a.pause();
      a.onended = null;
      a.onerror = null;
    };
  }, []);
  useEffect(() => {
    stop();
    queue.current = lines;
    cursor.current = 0;
    setStatus("idle");
    resumeAfterPanel.current = false;
    if (ready && enabled && !panelOpen && lines.length) playAt(0);
    // Scope is the identity of visible dialogue; unrelated UI changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, ready, enabled]);
  useEffect(() => {
    const a = player.current;
    if (!a) return;
    if (panelOpen) {
      resumeAfterPanel.current = !a.paused;
      a.pause();
      if (resumeAfterPanel.current) setStatus("paused");
    } else if (resumeAfterPanel.current && enabledRef.current) {
      resumeAfterPanel.current = false;
      void a
        .play()
        .then(() => setStatus("playing"))
        .catch(() => setStatus("blocked"));
    }
  }, [panelOpen]);
  useEffect(() => {
    let backgroundWasPlaying = false;
    const onVisibility = () => {
      const a = player.current;
      if (!a) return;
      if (document.hidden) {
        backgroundWasPlaying = !a.paused;
        a.pause();
        if (backgroundWasPlaying) setStatus("paused");
      } else if (backgroundWasPlaying && !panelOpen && enabledRef.current) {
        backgroundWasPlaying = false;
        void a
          .play()
          .then(() => setStatus("playing"))
          .catch(() => setStatus("blocked"));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [panelOpen]);
  return {
    enabled,
    status,
    active,
    toggleEnabled: () =>
      setEnabled((old) => {
        const next = !old;
        try {
          localStorage.setItem("socrates-voice", next ? "on" : "off");
        } catch {}
        return next;
      }),
    toggle: () => {
      if (!enabled) {
        setEnabled(true);
        return;
      }
      const a = player.current;
      if (!a) return;
      if (status === "playing") {
        a.pause();
        setStatus("paused");
      } else if (status === "paused") {
        void a
          .play()
          .then(() => setStatus("playing"))
          .catch(() => setStatus("blocked"));
      } else playAt(status === "blocked" ? cursor.current : 0);
    },
    replay: () => {
      if (!enabled) setEnabled(true);
      else playAt(0);
    },
    stop,
  };
}
