"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/useUser";

type Profile = {
  id: string;
  username: string;
  is_admin: boolean;
};

export function useProfile() {
  const { user, isLoading: userLoading } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("id, username, is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        setIsLoading(false);
      });
  }, [user, userLoading]);

  return { profile, isLoading: userLoading || isLoading };
}