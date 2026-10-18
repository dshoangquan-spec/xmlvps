import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster";
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { Be_Vietnam_Pro } from 'next/font/google';
import AppNavigation from '@/components/layout/app-navigation';

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: 'Thuốc Số XML - Hệ thống Xử lý Hóa đơn XML & Dược phẩm',
  description: 'Phân tích cú pháp hóa đơn XML, khớp ánh xạ dược phẩm thông minh và xuất dữ liệu liên thông.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={beVietnamPro.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <FirebaseClientProvider>
          <AppNavigation />
          <div className="flex-1 w-full">
            {children}
          </div>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
