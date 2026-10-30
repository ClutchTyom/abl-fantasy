import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Команда",
  description: "Состав и статистика команды ABL.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
