import Image from "next/image";

type BeamLogoProps = {
  className?: string;
  height?: number;
  width?: number;
  priority?: boolean;
};

export function BeamLogo({ className, height = 32, width = 100, priority }: BeamLogoProps) {
  return (
    <Image
      src="/beam-logo.png"
      alt="Beam"
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
