"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

const LINKS = [
  { href: "/", label: "Главная" },
  { href: "/players", label: "Игроки" },
  { href: "/team", label: "Моя команда" },
  { href: "/leaderboard", label: "Рейтинг" },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur shadow-sm px-6 py-4 flex items-center justify-between">
      <div className="flex gap-6 font-medium">
        {LINKS.map((link) => {
          const isActive =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? "text-blue-600 font-semibold"
                  : "text-gray-700 hover:text-blue-600 transition"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex gap-4 items-center">
        {user ? (
          <>
            <span className="text-gray-600 text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-red-600 font-medium hover:underline"
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="font-medium hover:underline">
              Вход
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
