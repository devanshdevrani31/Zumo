import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zumo - AI Employee Platform',
  description: 'Deploy and orchestrate AI employees that operate like real teammates',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-900 text-white`}>
        {children}
      </body>
    </html>
  )
}
