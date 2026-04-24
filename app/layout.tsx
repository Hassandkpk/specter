import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'] });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-editorial', weight: ['300', '400'] });

export const metadata: Metadata = {
  title: 'Viral Topic Finder',
  description: 'Discover trending topics in any niche and generate fresh content ideas with AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable} ${cormorant.variable} font-sans bg-cream text-z-black`}>
        {children}
      </body>
    </html>
  );
}
