import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import ThemeScript from "@/components/ThemeScript";

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
  title: "아야 AyaUke - HONEYZ 버튜버 팬페이지",
  description: "허니즈의 메인보컬이자 생활애교가 흘러넘치는 치지직의 분내담당 아야의 팬이 만든 페이지입니다. 노래책과 활동 정보를 제공합니다.",
  keywords: ["아야", "AyaUke", "HONEYZ", "버튜버", "VTuber", "노래방송", "게임방송"],
  authors: [{ name: "AyaUke" }],
  creator: "AyaUke",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "아야 AyaUke - HONEYZ 버튜버 팬페이지",
    description: "허니즈의 메인보컬이자 생활애교가 흘러넘치는 치지직의 분내담당 아야의 팬페이지",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/honeyz_pink.png",
        width: 1200,
        height: 630,
        alt: "아야 AyaUke - HONEYZ 버튜버",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "아야 AyaUke - HONEYZ 버튜버",
    description: "HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버",
    images: ["/honeyz_pink.png"],
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
        {children}
      </body>
    </html>
  );
}
