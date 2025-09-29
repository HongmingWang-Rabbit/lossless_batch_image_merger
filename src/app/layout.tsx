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
  title: "Lossless Batch Image Merger - Merge Multiple Images Online Free",
  description: "Free online tool to merge multiple images into one without quality loss. Combine photos vertically, horizontally, or in a grid. Support for PNG lossless merging with batch processing. No watermarks, no size limits.",
  keywords: [
    "lossless image merger",
    "batch image merge",
    "combine images online",
    "merge photos",
    "image stitching",
    "photo merger",
    "PNG merger",
    "lossless PNG",
    "batch image processing",
    "merge multiple images",
    "image combiner",
    "vertical image merge",
    "horizontal image merge",
    "grid image layout",
    "free image merger",
    "no watermark",
    "high quality image merge",
    "bulk image combine",
  ],
  authors: [{ name: "Lossless Image Merger" }],
  creator: "Lossless Image Merger",
  publisher: "Lossless Image Merger",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://losslessimagemerge.com",
    title: "Lossless Batch Image Merger - Merge Images Without Quality Loss",
    description: "Free online tool to merge multiple images into one. Combine photos vertically, horizontally, or in a grid layout. Completely lossless PNG output with no file size limits.",
    siteName: "Lossless Image Merger",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lossless Batch Image Merger Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lossless Batch Image Merger - Free Online Tool",
    description: "Merge multiple images into one without quality loss. Support for vertical, horizontal, and grid layouts.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://losslessimagemerge.com",
  },
  category: "Image Processing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
