import type { Metadata } from 'next';
import '@/style/globals.css';

// fonts
import { geistSans, geistMono } from '@/public/fonts';
import { Provider } from '@/components/common/Provider';

export const metadata: Metadata = {
  title: 'Yooo | Wosh',
  description:
    'A local first, zero knowledge and zero exposure secret manager build on top of browser based cryptography. Share secrets with your team without compromising security.',
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
