"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const { profile, isLoading } = useProfile();
  const { user } = useUser();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!profile || !profile.is_admin)) {
      router.push("/");
    }
  }, [isLoading, profile, router]);

  async function loadUsers() {
    setLoadingUsers(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("admin_list_users");

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setUsers((data as AdminUser[]) ?? []);
    }

    setLoadingUsers(false);
  }

  useEffect(() => {
    if (profile?.is_admin) {
      queueMicrotask(() => {
        loadUsers();
      });
    }
  }, [profile]);

  async function handleToggleAdmin(target: AdminUser) {
    const nextIsAdmin = !target.is_admin;

    if (
      !nextIsAdmin &&
      !confirm(`Забрать права администратора у «${target.username}»?`)
    ) {
      return;
    }

    setPendingId(target.id);

    const { error: rpcError } = await supabase.rpc("admin_set_is_admin", {
      target_user_id: target.id,
      new_is_admin: nextIsAdmin,
    });

    setPendingId(null);

    if (rpcError) {
      alert(`Ошибка: ${rpcError.message}`);
      return;
    }

    setUsers((current) =>
      current.map((u) => (u.id === target.id ? { ...u, is_admin: nextIsAdmin } : u))
    );
  }

  if (isLoading) {
    return <p className="p-8">Загрузка...</p>;
  }

  if (!profile || !profile.is_admin) {
    return null;
  }

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-8">
      <Link href="/admin" className="text-blue-600 hover:underline text-sm">
        ← Назад в админ-панель
      </Link>

      <h1 className="text-3xl font-bold mt-3 mb-1">Пользователи</h1>
      <p className="text-gray-500 mb-8">
        Здесь можно выдать или забрать права администратора.
      </p>

      {loadingUsers ? (
        <p>Загрузка...</p>
      ) : error ? (
        <p className="text-red-600">Ошибка: {error}</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Никнейм</th>
                <th className="p-3">Email</th>
                <th className="p-3">Зарегистрирован</th>
                <th className="p-3">Статус</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{u.username}</td>
                  <td className="p-3 text-gray-500">{u.email}</td>
                  <td className="p-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="p-3">
                    {u.is_admin ? (
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        Админ
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      disabled={pendingId === u.id || u.id === user?.id}
                      title={
                        u.id === user?.id
                          ? "Нельзя изменить права самому себе"
                          : undefined
                      }
                      className={
                        u.is_admin
                          ? "bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-sm font-semibold px-3 py-1 rounded-lg transition"
                          : "bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-1 rounded-lg transition"
                      }
                    >
                      {u.is_admin ? "Забрать права" : "Сделать админом"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
