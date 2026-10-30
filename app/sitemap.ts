import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

const PAGES = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/rules", changeFrequency: "monthly", priority: 0.8 },
  { path: "/schedule", changeFrequency: "weekly", priority: 0.7 },
  { path: "/players", changeFrequency: "weekly", priority: 0.7 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.6 },
  { path: "/register", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
