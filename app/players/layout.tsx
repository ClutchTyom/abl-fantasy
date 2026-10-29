import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Игроки",
  description: "Все игроки ABL с ценой, позицией и сезонной статистикой.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
