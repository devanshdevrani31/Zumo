'use client'

import { useState } from 'react'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded card */}
      {open && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-5 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Get in Touch</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Interested in Zumo? Whether you&apos;re an investor, a potential partner, or just
            want to connect &mdash; we&apos;d love to hear from you.
          </p>
          <a
            href="mailto:devanshdevrani@gmail.com?subject=Interested in Zumo&body=Hi, I'd like to learn more about Zumo."
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send us an Email
          </a>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-200
          ${open
            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
          }
        `}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-medium">Feedback</span>
      </button>
    </div>
  )
}
