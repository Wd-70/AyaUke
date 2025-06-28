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
  title: "아야 AyaUke - HONEYZ 버튜버",
  description: "HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버 아야 AyaUke의 공식 웹사이트입니다.",
  keywords: ["아야", "AyaUke", "HONEYZ", "버튜버", "VTuber", "노래방송", "게임방송"],
  authors: [{ name: "AyaUke" }],
  creator: "AyaUke",
  openGraph: {
    title: "아야 AyaUke - HONEYZ 버튜버",
    description: "HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "아야 AyaUke - HONEYZ 버튜버",
    description: "HONEYZ의 따뜻한 목소리, 게임과 노래를 사랑하는 버튜버",
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
        <link rel="icon" href="/favicon.ico" />
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
