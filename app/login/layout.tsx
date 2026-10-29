import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в аккаунт ABL Fantasy.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
