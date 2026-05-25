"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type WindowMode = "auto" | "open" | "closed";

function getCookie(name: string): string {
  return (
    document.cookie
      .split(";")
      .find((c) => c.trim().startsWith(name + "="))
      ?.split("=")[1] ?? ""
  );
}

function setCookie(name: string, value: string) {
  const exp = new Date(Date.now() + 86_400_000 * 30).toUTCString();
  document.cookie = `${name}=${value}; path=/; expires=${exp}`;
}

export function DevController() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WindowMode>("auto");
  const [queue, setQueue] = useState(0);

  useEffect(() => {
    const savedMode = getCookie("dev_window") as WindowMode;
    if (savedMode) setMode(savedMode);
    const savedQueue = parseInt(getCookie("dev_queue") || "0");
    if (!isNaN(savedQueue)) setQueue(savedQueue);
  }, []);

  function applyMode(m: WindowMode) {
    setMode(m);
    setCookie("dev_window", m);
    router.refresh();
  }

  function applyQueue(q: number) {
    setQueue(q);
    setCookie("dev_queue", String(q));
    router.refresh();
  }

  const modeColor =
    mode === "open" ? "#2F7D4F" : mode === "closed" ? "#60403F" : "#C9A227";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 font-body">
      {open && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-4 shadow-2xl"
          style={{
            background: "#1a1c1e",
            border: "1px solid #333",
            color: "#F8EAD5",
            minWidth: 230,
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#C9A227" }}
          >
            Dev Controls
          </p>

          {/* Window override */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-cream/50 uppercase tracking-widest">
              Ordering window
            </p>
            <div className="flex gap-1">
              {(["auto", "open", "closed"] as WindowMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => applyMode(m)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={
                    mode === m
                      ? { background: modeColor, color: "#F8EAD5" }
                      : { background: "#2a2d30", color: "#F8EAD588" }
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Queue slider */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-cream/50 uppercase tracking-widest">
              Queue ahead:{" "}
              <span className="text-cream font-bold">{queue}</span> pizzas
            </p>
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={queue}
              onChange={(e) => applyQueue(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "#2F7D4F" }}
            />
            <div className="flex justify-between text-xs text-cream/30">
              <span>0</span>
              <span>48</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold px-3 py-1.5 rounded-full shadow-lg transition-opacity hover:opacity-90"
        style={{ background: modeColor, color: "#F8EAD5" }}
      >
        DEV{mode !== "auto" ? ` · ${mode}` : ""}
        {queue > 0 ? ` · ${queue}q` : ""}
      </button>
    </div>
  );
}
