import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoLinesJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-jp",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "SOL監査訪問 - 監理支援機関向け管理システム",
  description: "監理型育成就労実施者および労働者の管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={notoLinesJP.className} style={{ background: '#f8fafc', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
