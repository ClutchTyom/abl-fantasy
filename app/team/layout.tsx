import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мой состав",
  description: "Соберите состав из 10 игроков в рамках бюджета и выберите капитана.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
