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

export const metadata = {
  title: "Mockly AI",
  description: "AI-Powered Mock Interviews Platform",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
        {children}
        <footer className="fixed bottom-0 w-full py-3 text-center text-slate-600 text-xs font-medium tracking-wide pointer-events-none z-10">
          Made by <span className="text-indigo-400">Chirag Kashyap</span>
        </footer>
      </body>
    </html>
  );
}
