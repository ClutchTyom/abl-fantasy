import Image from "next/image";

type TeamLogoProps = {
  logoUrl?: string | null;
  shortName: string;
  size?: number;
};

export default function TeamLogo({ logoUrl, shortName, size = 40 }: TeamLogoProps) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={shortName}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-gray-100 flex-shrink-0 bg-white"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}
      className="rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0"
    >
      {shortName}
    </div>
  );
}
