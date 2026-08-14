export type BadgeColor = "blue" | "green" | "purple" | "orange" | "red" | "gray";

type BadgeProps = {
  text: string;
  color?: BadgeColor;
};

// "blue" здесь — не фирменный акцент, а один из 5 категориальных цветов,
// которыми различаются позиции игрока (PG/SG/SF/PF/C) на глаз. C уже
// занял "red", а фирменный акцент теперь тоже красный (abl-*) — если
// сделать PG тоже красным, три разных вещи станут одного цвета и метка
// перестанет что-либо различать. Поэтому здесь сознательно настоящий
// Tailwind-синий, а не abl-*.
const COLOR_STYLES: Record<BadgeColor, string> = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-600",
};

export default function Badge({ text, color = "blue" }: BadgeProps) {
  return (
    <span
      className={`${COLOR_STYLES[color]} px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap`}
    >
      {text}
    </span>
  );
}
