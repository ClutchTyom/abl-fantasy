"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    router.push("/team");
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Вход</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2"
          />
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
        >
          {isLoading ? "Входим..." : "Войти"}
        </button>
      </form>
    </main>
  );
}