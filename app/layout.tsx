import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "pszichovasar",
  description: "Artem — illustration, 3D design, video editing, visual effects, concept art, motion design",
  openGraph: {
    title: "pszichovasar",
    description: "Artem — illustration, 3D design, video editing, visual effects, concept art",
    url: "https://pszichovasar.com",
    siteName: "pszichovasar",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}