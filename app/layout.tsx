import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import AppLayout from "./components/AppLayout";

export const metadata: Metadata = {
  title: "Leaflet Employee",
  description: "Modern employee and admin operations workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
