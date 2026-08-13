"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

const LINKS = [
  { href: "/", label: "Главная" },
  { href: "/schedule", label: "Календарь" },
  { href: "/players", label: "Игроки" },
  { href: "/team", label: "Моя команда" },
  { href: "/leaderboard", label: "Рейтинг" },
  { href: "/rules", label: "Правила" },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  useEffect(() => {
    queueMicrotask(() => setIsMenuOpen(false));
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActiveLink(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="md:hidden font-bold text-lg text-gray-900">
          ABL Fantasy
        </Link>

        <div className="hidden md:flex gap-6 font-medium">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActiveLink(link.href)
                  ? "text-blue-600 font-semibold"
                  : "text-gray-700 hover:text-blue-600 transition"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex gap-4 items-center">
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

        <button
          onClick={() => setIsMenuOpen((open) => !open)}
          className="md:hidden p-2 -mr-2 text-gray-700"
          aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
        >
          {isMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block font-medium py-1 ${
                isActiveLink(link.href) ? "text-blue-600" : "text-gray-700"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="pt-3 border-t">
            {user ? (
              <>
                <p className="text-gray-600 text-sm mb-3">{user.email}</p>
                <button onClick={handleLogout} className="text-red-600 font-medium">
                  Выйти
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <Link href="/login" className="font-medium">
                  Вход
                </Link>
                <Link
                  href="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-center transition"
                >
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
