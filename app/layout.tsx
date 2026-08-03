import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flomo 整理器",
  description: "将 Markdown 或 Excel 表格整理成一行一条的 Flomo 备忘录。",
  manifest: "./manifest.webmanifest",
  icons: { icon: "./favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#15382f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
