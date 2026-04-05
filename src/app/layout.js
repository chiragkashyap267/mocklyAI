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
      <body className="min-h-full flex flex-col relative pb-16">
        {children}
        <footer className="absolute bottom-0 w-full py-4 text-center text-slate-500 text-sm font-medium tracking-wide">
          Made by <span className="text-indigo-400">Chirag Kashyap</span>
        </footer>
      </body>
    </html>
  );
}
