import logoImg from "@/assets/infinity-logo.png";

export function InfinityLogo({ size = 48 }: { size?: number }) {
  return (
    <img
      src={logoImg}
      alt="Infinity I.A"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
