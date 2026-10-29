import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Расписание",
  description: "Календарь ближайших матчей ABL по дивизионам.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
