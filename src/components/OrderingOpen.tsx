import type { ActiveServiceNight } from "@/lib/availability";

interface OrderingOpenProps {
  serviceNight: ActiveServiceNight;
  poolRemaining: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function OrderingOpen({ serviceNight, poolRemaining }: OrderingOpenProps) {
  const pickupDate = formatDate(
    new Date(serviceNight.service_date + "T18:00:00").toISOString()
  );

  return (
    <div
      className="rounded-2xl p-7 flex flex-col gap-4"
      style={{ background: "#3A3E43", borderLeft: "4px solid #2F7D4F" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-basil uppercase tracking-[.2em] font-body font-bold mb-1">
            Ordering is open
          </p>
          <p className="font-display font-black text-cream text-xl">
            Pickup {pickupDate}
          </p>
          <p className="text-sm text-cream/60 mt-0.5">
            Closes {formatTime(serviceNight.order_close_at)} · Pickup{" "}
            {serviceNight.service_start.slice(0, 5).replace(":", ":")}–
            {serviceNight.last_pickup.slice(0, 5).replace(":", ":")} PM
          </p>
        </div>

        {poolRemaining <= 10 && poolRemaining > 0 && (
          <span
            className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: "#C9A227", color: "#3A3E43" }}
          >
            {poolRemaining} left
          </span>
        )}
      </div>

      <a
        href="/order"
        className="block text-center font-body font-bold text-base py-3.5 rounded-xl transition-opacity hover:opacity-90"
        style={{ background: "#2F7D4F", color: "#F8EAD5" }}
      >
        Order Now
      </a>
    </div>
  );
}
