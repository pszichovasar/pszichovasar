import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MY NAME IS ARTEM",
  description: "I'M A DESIGNER",
  openGraph: {
    title: "MY NAME IS ARTEM",
    description: "I'M A DESIGNER",
    url: 'https://pszichovasar.com/',
    siteName: 'PSZICHOVASAR',
    images: [
      {
        url: '/og-image.jpg', // Положите картинку в папку public
        width: 1000,
        height: 1000,
      },
    ],
    locale: 'https://pszichovasar.com/',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
