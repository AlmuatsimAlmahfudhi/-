import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource-variable/inter";
import "./globals.css";
import { GameProvider } from "@/components/GameProvider";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "ألسُن — مغامرة تعلم اللغات",
  description: "تعلّم الإنجليزية والفرنسية والإسبانية والصينية من الصفر بنظام لعب ومحادثة صوتية بالذكاء الاصطناعي",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ألسُن", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1020",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full">
        <GameProvider>
          <div className="mx-auto min-h-dvh w-full max-w-3xl pb-24">{children}</div>
          <BottomNav />
        </GameProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
