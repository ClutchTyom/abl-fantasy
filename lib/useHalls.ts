"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Hall = {
  id: string;
  slug: string;
  name: string;
};

export function useHalls() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("halls")
      .select("id, slug, name")
      .order("sort")
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        setHalls((data as Hall[] | null) ?? []);
        setIsLoading(false);
      });
  }, []);

  return { halls, isLoading, error };
}
