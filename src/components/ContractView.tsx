import type { ContractSection } from "@/lib/event-contract";

// The contract sections as plain markup. Each page styles .contract its own way
// (cream-on-slate on the client page, black on white in the admin print view).
export function ContractView({ sections }: { sections: ContractSection[] }) {
  return (
    <div className="contract">
      {sections.map((s) => (
        <section key={s.heading}>
          <h3>{s.heading}</h3>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
