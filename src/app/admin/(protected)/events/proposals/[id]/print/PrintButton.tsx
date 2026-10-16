"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        font: "700 13px var(--font-archivo), sans-serif",
        padding: "8px 16px",
        borderRadius: 100,
        border: "none",
        background: "#2F7D4F",
        color: "#F8EAD5",
        cursor: "pointer",
      }}
    >
      Print or save as PDF
    </button>
  );
}
