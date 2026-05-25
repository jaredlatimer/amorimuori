interface PizzaCardProps {
  name: string;
  description: string;
  price_cents: number;
  allergens: string[];
  is_special: boolean;
  available?: number | null;
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function PizzaCard({
  name,
  description,
  price_cents,
  allergens,
  is_special,
  available,
}: PizzaCardProps) {
  const soldOut = available === 0;

  return (
    <div
      className={`relative rounded-2xl p-5 flex flex-col gap-2 transition-opacity ${
        soldOut ? "opacity-50" : ""
      }`}
      style={{ background: "#3A3E43" }}
    >
      {is_special && (
        <span
          className="absolute top-4 right-4 text-xs font-body font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
          style={{ background: "#E8C24A", color: "#3A3E43" }}
        >
          Special
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-cream text-lg leading-tight">
          {name}
        </h3>
        <span className="font-display font-black text-cream text-xl shrink-0">
          {formatPrice(price_cents)}
        </span>
      </div>

      <p className="text-sm text-cream/70 leading-relaxed">{description}</p>

      <div className="flex items-center justify-between mt-1">
        {allergens.length > 0 && (
          <p className="text-xs text-cream/40 uppercase tracking-wide">
            {allergens.join(", ")}
          </p>
        )}
        {soldOut && (
          <span className="text-xs font-bold text-oxblood ml-auto">
            Sold out
          </span>
        )}
        {available !== null && available !== undefined && available > 0 && available <= 5 && (
          <span className="text-xs font-semibold text-gold ml-auto">
            {available} left
          </span>
        )}
      </div>
    </div>
  );
}
