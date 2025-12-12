import { Toaster } from '@/components/ui/toaster'
import { ConditionalTopNavbar } from '@/components/shared/ConditionalTopNavbar'
import Link from 'next/link'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-screen bg-white">
      <ConditionalTopNavbar />

      <div className="min-h-[calc(100vh-4rem)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          {children}
        </div>
        <footer className="pb-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-dark-600">
            <div className="flex gap-4">
              <Link href="/pricing">Pricing</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
            </div>
            <span>© {new Date().getFullYear()} Shoppable Videos</span>
          </div>
        </footer>
      </div>
      
      <Toaster />
    </main>
  )
}

export default Layout
