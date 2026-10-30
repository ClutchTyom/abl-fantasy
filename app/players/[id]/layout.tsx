import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Игрок",
  description: "Статистика и фэнтези-очки игрока ABL по матчам.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
