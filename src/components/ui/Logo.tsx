import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 48, className }: LogoProps) {
  return (
    <Image
      src="/logo-mark.png"
      alt="Amori Muori logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Logo size={40} />
      <div
        className="font-display font-black text-cream leading-[.95] tracking-tight"
        style={{ fontSize: "1.375rem" }}
      >
        AMORI
        <br />
        MUORI
      </div>
    </div>
  );
}
