import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import ThemeScript from "@/components/ThemeScript";
import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/contexts/AuthProvider";
import ActivityTracker from "@/components/ActivityTracker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "아야 AyaUke",
  description: "아야가 부르는 노래들을 모아둔 노래책 사이트. K-pop, J-pop, 최신곡까지 다양한 곡들과 라이브 클립을 확인하고 플레이리스트를 만들어보세요.",
  keywords: ["아야", "AyaUke", "HONEYZ", "버튜버", "VTuber", "노래방송", "노래책", "플레이리스트"],
  authors: [{ name: "AyaUke" }],
  creator: "AyaUke",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "아야 AyaUke - 노래책",
    description: "아야가 부르는 노래들을 모아둔 노래책. K-pop, J-pop, 최신곡까지 다양한 곡들과 라이브 클립을 확인해보세요.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/profile1.png",
        width: 1200,
        height: 630,
        alt: "아야 AyaUke 노래책",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "아야 AyaUke - 노래책",
    description: "아야가 부르는 노래들을 모아둔 노래책. 플레이리스트 생성과 라이브 클립 확인이 가능합니다.",
    images: ["/profile1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/honeyz_pink.png" type="image/png" />
        <link rel="apple-touch-icon" href="/honeyz_pink.png" />
        <meta name="theme-color" content="#D1AFE3" />
        <ThemeScript />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ActivityTracker />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
