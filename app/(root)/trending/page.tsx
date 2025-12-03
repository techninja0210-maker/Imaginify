"use client"

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, TrendingDown, Heart, Bell } from 'lucide-react'
import ProductCard from '@/components/shared/ProductCard'
import { format } from 'date-fns'

interface WeeklyReport {
  id: string
  value: string
  label: string
  weekStart: string | Date
  weekEnd: string | Date
}

interface TrendingProductData {
  id: string
  rank: number
  productId: string
  productName: string
  displayImageUrl: string
  sales7d: number
  commission: string
  videoThumbnails: string[]
  isFavorite: boolean
  tiktokProductUrl: string
  amazonUrl?: string
  category?: string
}

export default function TrendingProductsPage() {
  const { user } = useUser()
  const [isMounted, setIsMounted] = useState(false)
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  
  // Data state
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [products, setProducts] = useState<TrendingProductData[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reportsError, setReportsError] = useState<string | null>(null)
  
  // Filter state
  const [platform, setPlatform] = useState<'tiktok' | 'amazon' | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [commissionRange, setCommissionRange] = useState<string>('all')
  const [salesRange, setSalesRange] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'rank' | 'trending-up' | 'trending-down'>('rank')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    setIsMounted(true)
    
    const portalContainer = document.createElement('div')
    portalContainer.setAttribute('data-trending-portal', 'true')
    document.body.appendChild(portalContainer)
    setPortalElement(portalContainer)
    
    const hideLayoutElements = () => {
      const sidebar = document.querySelector('aside.sidebar')
      const mobileNav = document.querySelector('header.header')
      const footer = document.querySelector('footer')
      const lowBalanceBanner = document.querySelector('[class*="LowBalanceBanner"]')
      const wrapper = document.querySelector('.root-container .wrapper')
      
      if (sidebar instanceof HTMLElement) {
        sidebar.style.cssText += 'display: none !important;'
      }
      if (mobileNav instanceof HTMLElement) {
        mobileNav.style.cssText += 'display: none !important;'
      }
      if (footer instanceof HTMLElement) {
        footer.style.cssText += 'display: none !important;'
      }
      if (lowBalanceBanner instanceof HTMLElement) {
        lowBalanceBanner.style.cssText += 'display: none !important;'
      }
      if (wrapper instanceof HTMLElement) {
        wrapper.style.cssText += 'display: none !important;'
      }
      
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
    }
    
    hideLayoutElements()
    const timeoutId = setTimeout(hideLayoutElements, 100)
    
    return () => {
      clearTimeout(timeoutId)
      const sidebar = document.querySelector('aside.sidebar')
      const mobileNav = document.querySelector('header.header')
      const footer = document.querySelector('footer')
      const wrapper = document.querySelector('.root-container .wrapper')
      const lowBalanceBanner = document.querySelector('[class*="LowBalanceBanner"]')
      
      if (sidebar instanceof HTMLElement) sidebar.style.cssText = ''
      if (mobileNav instanceof HTMLElement) mobileNav.style.cssText = ''
      if (footer instanceof HTMLElement) footer.style.cssText = ''
      if (wrapper instanceof HTMLElement) wrapper.style.cssText = ''
      if (lowBalanceBanner instanceof HTMLElement) lowBalanceBanner.style.cssText = ''
      
      const portal = document.querySelector('[data-trending-portal]')
      if (portal && portal.parentNode) {
        portal.parentNode.removeChild(portal)
      }
      
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  // Fetch weekly reports on mount
  useEffect(() => {
    async function fetchReports() {
      try {
        setReportsError(null)
        const response = await fetch('/api/trending/reports')
        const data = await response.json()
        if (data.success) {
          const validReports = (data.reports || []).filter((r: any) => r?.id && r.id.trim() !== '')
          console.log(`[TrendingPage] Loaded ${validReports.length} reports`)
          setReports(validReports)
          if (data.latest && data.latest.id && data.latest.id.trim() !== '') {
            console.log(`[TrendingPage] Setting selectedReportId to latest: ${data.latest.id}`)
            setSelectedReportId(data.latest.id)
          } else if (validReports.length > 0 && validReports[0]?.id && validReports[0].id.trim() !== '') {
            console.log(`[TrendingPage] Setting selectedReportId to first report: ${validReports[0].id}`)
            setSelectedReportId(validReports[0].id)
          } else {
            console.warn('[TrendingPage] No valid reports found')
            setSelectedReportId('')
          }
        } else {
          setReportsError(data.error || 'Failed to fetch reports')
        }
      } catch (error: any) {
        console.error('Error fetching reports:', error)
        setReportsError(error?.message || 'Failed to load reports')
      }
    }
    fetchReports()
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch products when filters change
  useEffect(() => {
    let cancelled = false
    
    async function fetchProducts() {
      // Check if selectedReportId is valid (not empty string or null/undefined)
      if (!selectedReportId || selectedReportId.trim() === '') {
        setProducts([])
        setCategories([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      
      console.log(`[TrendingPage] Fetching products for reportId: ${selectedReportId}`)
      
      try {
        const params = new URLSearchParams()
        params.append('reportId', selectedReportId)
        if (platform) params.append('platform', platform)
        if (category && category !== 'all') params.append('category', category)
        if (commissionRange && commissionRange !== 'all') {
          const [min, max] = commissionRange.split('-').map(Number)
          if (!isNaN(min) && min !== undefined) params.append('commissionMin', min.toString())
          if (!isNaN(max) && max !== undefined) params.append('commissionMax', max.toString())
        }
        if (salesRange && salesRange !== 'all') {
          const [min, max] = salesRange.split('-').map(Number)
          if (!isNaN(min) && min !== undefined) params.append('salesMin', min.toString())
          if (!isNaN(max) && max !== undefined) params.append('salesMax', max.toString())
        }
        if (debouncedSearch) params.append('search', debouncedSearch)
        params.append('sortBy', sortBy)
        if (favoritesOnly) params.append('favoritesOnly', 'true')

        const response = await fetch(`/api/trending/products?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Check if request was cancelled
        if (cancelled) return
        
        if (data.success) {
          const productsArray = Array.isArray(data.products) ? data.products : []
          setProducts(productsArray)
          
          console.log(`[TrendingPage] Fetched ${productsArray.length} products`)
          
          // Extract unique categories (filter out empty/invalid ones)
          const categorySet = new Set<string>()
          productsArray.forEach((p: TrendingProductData) => {
            if (p.category && typeof p.category === 'string' && p.category.trim() !== '') {
              categorySet.add(p.category.trim())
            }
          })
          setCategories(Array.from(categorySet).sort())
        } else {
          const errorMsg = data.error || 'Failed to fetch products'
          console.error('[TrendingPage] API error:', errorMsg)
          setError(errorMsg)
          setProducts([])
        }
      } catch (error: any) {
        if (cancelled) return
        console.error('[TrendingPage] Error fetching products:', error)
        const errorMsg = error?.message || 'Failed to load products. Please check the console for details.'
        setError(errorMsg)
        setProducts([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchProducts()
    
    return () => {
      cancelled = true
    }
  }, [selectedReportId, platform, category, commissionRange, salesRange, debouncedSearch, sortBy, favoritesOnly, user?.id])

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback(async (productId: string, currentState: boolean) => {
    if (!user?.id) {
      console.warn('User not logged in, cannot toggle favorite')
      return
    }
    
    try {
      const response = await fetch('/api/trending/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        // Update the product's favorite state
        setProducts((prev) =>
          prev.map((p) =>
            p.productId === productId ? { ...p, isFavorite: data.isFavorite } : p
          )
        )
      } else {
        console.error('Failed to toggle favorite:', data.error)
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
      // Optionally show user-friendly error message
    }
  }, [user?.id])

  // Get user ID from Clerk
  const getUserId = async () => {
    if (!user?.id) return null
    try {
      const response = await fetch(`/api/me/session`)
      const data = await response.json()
      return data.user?.id || null
    } catch {
      return null
    }
  }

  const pageContent = (
    <div 
      data-trending-page="true"
      className="fixed inset-0 flex flex-col bg-white overflow-auto w-screen h-screen z-[99999]"
    >
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl px-8 mx-auto">
          {/* Top Navigation Bar */}
          <header className="w-full bg-white px-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <Image
                  src="/img/logo.png"
                  alt="Shoppable Videos"
                  width={180}
                  height={40}
                  className="hidden md:block"
                  priority
                />
                <Image
                  src="/img/logo-responsive.png"
                  alt="Shoppable Videos"
                  width={120}
                  height={40}
                  className="block md:hidden"
                  priority
                />
              </Link>

              <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
                  <Bell className="w-5 h-5 text-gray-600" />
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </header>

          {/* Page Header Section */}
          <div className="flex items-start justify-between bg-white p-6">
    <div>
              <h1 className="text-2xl font-bold text-gray-900">Trending Products</h1>
              <p className="text-sm text-gray-500 mt-1">Updated weekly based on TikTok&apos;s top sellers</p>
            </div>

            {/* Date Range Selector */}
            {reportsError ? (
              <div className="text-sm text-red-600">{reportsError}</div>
            ) : reports.length === 0 ? (
              <div className="text-sm text-gray-500">No reports available</div>
            ) : (
              <Select 
                value={selectedReportId && selectedReportId.trim() !== '' ? selectedReportId : undefined} 
                onValueChange={(value) => {
                  if (value && value.trim() !== '') {
                    setSelectedReportId(value)
                  }
                }}
              >
                <SelectTrigger className="w-[180px] h-9 bg-white rounded-xl border border-gray-200 pt-[14px] pr-4 pb-3 pl-4 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg mt-1 z-[100000]">
                  {reports
                    .filter((report) => report.id && report.id.trim() !== '')
                    .map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        {report.label || `Report ${report.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Filter Bar Section */}
          <div className="px-6 space-y-4">
            {/* Top Row: Platform, Dropdowns, Search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Platform Selection Toggle */}
              <div className="flex flex-row items-start p-1 gap-[10px] w-[242px] h-9 bg-[#F5F6F7] border border-[#ECECEC] rounded-xl">
                <button
                  onClick={() => setPlatform(platform === 'tiktok' ? null : 'tiktok')}
                  className={`flex flex-col justify-center items-start cursor-pointer px-[14px] py-[6px] gap-[10px] w-[112px] h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                    platform === 'tiktok'
                      ? 'bg-white'
                      : 'bg-transparent hover:bg-white/50'
                  }`}
                >
                  <div className="flex flex-row items-center p-0 gap-[6px] w-[70px] h-[17px]">
                    <i className="fab fa-tiktok text-[17px] text-black" aria-hidden="true"></i>
                    <span className="text-sm font-medium text-black whitespace-nowrap">TikTok</span>
                  </div>
                </button>

                <button
                  onClick={() => setPlatform(platform === 'amazon' ? null : 'amazon')}
                  className={`flex flex-col justify-center items-start cursor-pointer px-[14px] py-[6px] gap-[10px] w-[112px] h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                    platform === 'amazon'
                      ? 'bg-white'
                      : 'bg-transparent hover:bg-white/50'
                  }`}
                >
                  <div className="flex flex-row items-center p-0 gap-[6px] w-[70px] h-[17px]">
                    <i className="fab fa-amazon text-[17px] text-[#FF9900]" aria-hidden="true"></i>
                    <span className="text-sm font-medium text-black whitespace-nowrap">Amazon</span>
                  </div>
                </button>
              </div>

              {/* Category Dropdown */}
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[188px] h-9 bg-white rounded-xl border border-gray-200 pt-[14px] pr-4 pb-3 pl-4 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg mt-1 z-[100000]">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories
                    .filter((cat) => cat && cat.trim() !== '')
                    .map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Commission Rate Dropdown */}
              <Select value={commissionRange} onValueChange={setCommissionRange}>
                <SelectTrigger className="w-[188px] h-9 bg-white rounded-xl border border-gray-200 pt-[14px] pr-4 pb-3 pl-4 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300">
                  <SelectValue placeholder="Commission Rate" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg mt-1 z-[100000]">
                  <SelectItem value="all">All Rates</SelectItem>
                  <SelectItem value="0-5">0% - 5%</SelectItem>
                  <SelectItem value="5-10">5% - 10%</SelectItem>
                  <SelectItem value="10-15">10% - 15%</SelectItem>
                  <SelectItem value="15-20">15% - 20%</SelectItem>
                  <SelectItem value="20-100">20%+</SelectItem>
                </SelectContent>
              </Select>

              {/* TikTok 7-Day Sales Dropdown */}
              <Select value={salesRange} onValueChange={setSalesRange}>
                <SelectTrigger className="w-[188px] h-9 bg-white rounded-xl border border-gray-200 pt-[14px] pr-4 pb-3 pl-4 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300">
                  <SelectValue placeholder="TikTok 7-Day Sales" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg mt-1 z-[100000]">
                  <SelectItem value="all">All Sales</SelectItem>
                  <SelectItem value="0-1000">0 - 1,000</SelectItem>
                  <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                  <SelectItem value="5000-10000">5,000 - 10,000</SelectItem>
                  <SelectItem value="10000-50000">10,000 - 50,000</SelectItem>
                  <SelectItem value="50000-999999999">50,000+</SelectItem>
                </SelectContent>
              </Select>

              {/* Search Input */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <Input
                    type="search"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 bg-white rounded-xl border border-gray-200 pt-[14px] pr-4 pb-3 pl-10 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300 placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Row: Trending Up/Down, Favorites */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSortBy(sortBy === 'trending-up' ? 'rank' : 'trending-up')}
                className={`w-[158px] h-9 rounded-xl border pt-[14px] pr-4 pb-3 pl-4 flex items-center justify-between gap-2 text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  sortBy === 'trending-up'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>Trending Up</span>
                <TrendingUp className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setSortBy(sortBy === 'trending-down' ? 'rank' : 'trending-down')}
                className={`w-[158px] h-9 rounded-xl border pt-[14px] pr-4 pb-3 pl-4 flex items-center justify-between gap-2 text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  sortBy === 'trending-down'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>Trending Down</span>
                <TrendingDown className="w-4 h-4" />
              </button>

              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`w-[158px] h-9 rounded-xl border pt-[14px] pr-4 pb-3 pl-4 flex items-center justify-between gap-2 text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  favoritesOnly
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>Favorites</span>
                <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Product Grid Section */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-gray-200 rounded-xl aspect-[3/4] animate-pulse"
                />
              ))
            ) : !selectedReportId || selectedReportId.trim() === '' ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">
                  {reports.length === 0 
                    ? "No reports available. Please import trending products data from the admin panel."
                    : "Please select a date range to view products."}
                </p>
              </div>
            ) : products.length > 0 ? (
              products.map((product) => (
                <ProductCard
                  key={product.id || product.productId}
                  rank={product.rank}
                  productId={product.productId}
                  productName={product.productName || 'Unknown Product'}
                  displayImageUrl={product.displayImageUrl || '/img/product-placeholder.png'}
                  sales7d={product.sales7d || 0}
                  commission={product.commission || '0%'}
                  videoThumbnails={Array.isArray(product.videoThumbnails) ? product.videoThumbnails : []}
                  isFavorite={product.isFavorite || false}
                  onFavoriteToggle={() => handleFavoriteToggle(product.productId, product.isFavorite)}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 mb-2">No products found.</p>
                {selectedReportId && (
                  <p className="text-sm text-gray-400">
                    This report may not have any products yet. Try selecting a different date range or check if products have been imported.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (!isMounted || !portalElement) {
    return null
  }

  return createPortal(pageContent, portalElement)
}
