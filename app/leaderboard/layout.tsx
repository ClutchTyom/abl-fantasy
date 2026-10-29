import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Рейтинг",
  description: "Общий рейтинг участников ABL Fantasy по очкам за туры.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
