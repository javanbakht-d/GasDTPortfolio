import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "سامانه راهبری تحول دیجیتال و حکمرانی هوشمند | NIGC-DTG",
  description: "سامانه یکپارچه راهبری تحول دیجیتال، حاکمیت داده و هوش مصنوعی شرکت ملی گاز ایران — دبیرخانه شورای راهبری",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground font-vazir">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
