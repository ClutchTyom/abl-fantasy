import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FantasyProvider } from "@/context/FantasyContext";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import TelegramMiniApp from "@/components/layout/TelegramMiniApp";
import { SITE_URL } from "@/lib/siteUrl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ABL Fantasy", template: "%s — ABL Fantasy" },
  description:
    "Fantasy-лига по баскетболу ABL: соберите состав из 10 игроков, выберите капитана и соревнуйтесь в рейтинге.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "ABL Fantasy",
    title: "ABL Fantasy",
    description: "Fantasy-лига по баскетболу ABL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TelegramMiniApp />
        <FantasyProvider>
          <Nav />
          <div className="flex-1">{children}</div>
          <Footer />
        </FantasyProvider>
      </body>
    </html>
  );
}