import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SupabaseProvider } from "@/components/providers/supabase-provider";
import { LanguageProvider } from "@/i18n/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "lvcheck | 최대 레버리지 계산기",
  description:
    "진입가, 손절가, 허용 손실 한도로 최대 레버리지를 계산하는 서버리스 도구",
  metadataBase: new URL("https://lvcheck.vercel.app"),
  openGraph: {
    title: "lvcheck | 최대 레버리지 계산기",
    description:
      "진입가, 손절가, 허용 손실만 입력하면 즉시 최대 레버리지를 산출하는 Next.js 웹앱",
    url: "https://lvcheck.vercel.app",
    siteName: "lvcheck",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "lvcheck | 최대 레버리지 계산기",
    description:
      "진입가-손절가 기반 레버리지 계산, 손익비 분석을 하나의 화면에서.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="ko" className="bg-slate-950">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950`}>
        <LanguageProvider>
          <SupabaseProvider initialSession={session}>{children}</SupabaseProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
