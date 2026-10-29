import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создайте аккаунт и соберите свой состав в ABL Fantasy.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
