import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import './platform-finance.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-admin', display: 'swap' });

export const metadata: Metadata = {
  title: 'TurfBookPK Admin',
  description: 'TurfBookPK marketplace operations',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable}><body>{children}</body></html>;
}
