import MobileNav from '@/components/shared/MobileNav'
import Sidebar from '@/components/shared/Sidebar'
import { Toaster } from '@/components/ui/toaster'
import { LowBalanceBanner } from '@/components/shared/LowBalanceBanner'
import Link from 'next/link'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="root">
      <Sidebar />
      <MobileNav />
      <LowBalanceBanner />

      <div className="root-container">
        <div className="wrapper">
          {children}
        </div>
        <footer className="px-6 pb-6">
          <div className="wrapper flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-dark-600">
            <div className="flex gap-4">
              <Link href="/pricing">Pricing</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
            </div>
            <span>© {new Date().getFullYear()} Imaginify</span>
          </div>
        </footer>
      </div>
      
      <Toaster />
    </main>
  )
}

export default Layout