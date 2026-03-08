import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanSlot NG — Healthcare Booking",
  description: "Book healthcare services across Nigeria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
