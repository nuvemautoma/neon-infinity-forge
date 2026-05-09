import logoImg from "@/assets/infinity-logo.png";

export function InfinityLogo({ size = 48, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Soft halo */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.65 0.22 250 / 70%), transparent 70%)",
        }}
      />
      {/* Rotating conic ring */}
      {animated && (
        <div
          aria-hidden
          className="absolute rounded-full opacity-40 animate-spin-slow"
          style={{
            inset: -size * 0.18,
            background:
              "conic-gradient(from 0deg, transparent, oklch(0.70 0.25 240 / 60%), transparent 60%)",
            filter: "blur(8px)",
          }}
        />
      )}
      <img
        src={logoImg}
        alt="Infinity I.A"
        width={size}
        height={size}
        className={`relative object-contain ${animated ? "animate-logo-pulse" : ""}`}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
