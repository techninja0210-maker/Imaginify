"use client"

import { useEffect } from 'react'
import Image from 'next/image'

export default function LandingPage() {
  useEffect(() => {
    // Hide sidebar, nav, and footer when on landing page
    const sidebar = document.querySelector('aside.sidebar')
    const mobileNav = document.querySelector('header.header')
    const footer = document.querySelector('footer')
    
    if (sidebar) (sidebar as HTMLElement).style.display = 'none'
    if (mobileNav) (mobileNav as HTMLElement).style.display = 'none'
    if (footer) (footer as HTMLElement).style.display = 'none'
    
    // Set body background to yellow
    document.body.style.backgroundColor = '#F5C14F'
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.overflow = 'hidden'
    
    return () => {
      // Cleanup on unmount
      if (sidebar) (sidebar as HTMLElement).style.display = ''
      if (mobileNav) (mobileNav as HTMLElement).style.display = ''
      if (footer) (footer as HTMLElement).style.display = ''
      document.body.style.backgroundColor = ''
      document.body.style.margin = ''
      document.body.style.padding = ''
      document.body.style.overflow = ''
    }
  }, [])

  const waitlistFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScpFFLHIUk6JB1KgkWf8MI_RxDHE4fRYd6YSJ8W15pvKEYVmA/viewform?usp=header'

  return (
    <div 
      className="fixed inset-0 bg-[#F5C14F] flex flex-col items-center justify-center z-[99999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#F5C14F'
      }}
    >
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 w-full max-w-4xl mx-auto space-y-8">
        {/* Centered Logo */}
        <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <Image 
            src="/img/logo.png" 
            alt="Shoppable Videos" 
            width={800}
            height={400}
            className="w-full h-auto object-contain"
            priority
            quality={95}
          />
        </div>

        {/* Waitlist Text and Link */}
        <div className="text-center">
          <p className="text-lg sm:text-xl md:text-2xl text-gray-900 font-medium mb-2">
            Join the waitlist by completing{' '}
            <a
              href={waitlistFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:text-blue-800 underline font-semibold transition-colors"
            >
              this form
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
