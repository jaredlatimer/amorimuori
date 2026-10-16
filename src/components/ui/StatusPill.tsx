import type { NightTone } from "@/lib/night-status";

const PILL: Record<NightTone, React.CSSProperties> = {
  open: { background: "#2F7D4F", color: "#F8EAD5" },
  soon: { background: "#E8C24A", color: "#3A3E43" },
  out: { background: "#60403F", color: "#F8EAD5" },
  closed: { background: "#F8EAD51a", color: "#F8EAD5aa" },
};

export function StatusPill({ label, tone }: { label: string; tone: NightTone }) {
  return (
    <span
      style={{
        ...PILL[tone],
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 100,
        padding: "4px 11px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
