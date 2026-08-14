"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/players", label: "Игроки" },
  { href: "/admin/teams", label: "Команды" },
  { href: "/admin/rounds", label: "Туры" },
  { href: "/admin/matches", label: "Матчи" },
  { href: "/admin/import", label: "Импорт из ABL" },
  { href: "/admin/pricing", label: "Пересчёт цен" },
  { href: "/admin/users", label: "Пользователи" },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!profile || !profile.is_admin)) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-5">Админ-панель</h1>

      <nav className="flex flex-wrap gap-2 mb-8 pb-5 border-b">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? "bg-abl-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
