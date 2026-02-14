'use client'

import AuthProvider from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'
import FeedbackButton from '@/components/FeedbackButton'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pt-16 lg:p-8 lg:pt-8">
          {children}
        </main>
      </div>
      <FeedbackButton />
    </AuthProvider>
  )
}
