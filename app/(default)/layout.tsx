import type { Metadata } from 'next';
import '@/style/globals.css';

// fonts
import { geistSans } from '@/public/fonts';
import { Provider } from '@/components/common/Provider';
import { Header } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Wosh | Manage your secrets',
  description:
    'A local first, zero knowledge and zero exposure secret manager build on top of browser based cryptography. Share secrets with your team without compromising security.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} antialiased`}>
        <Provider>
          <Header />
          {children}
        </Provider>
      </body>
    </html>
  );
}
