"use client"

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Search, TrendingUp, TrendingDown, Heart, Bell, Filter, X } from 'lucide-react'
import ProductCard from '@/components/shared/ProductCard'
import DateRangeSelector from '@/components/shared/DateRangeSelector'
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
  
  // Mobile filter modal state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  // Temporary filter state for modal (applied on "Apply")
  const [tempPlatform, setTempPlatform] = useState<'tiktok' | 'amazon' | null>(null)
  const [tempCategory, setTempCategory] = useState<string>('all')
  const [tempCommissionRange, setTempCommissionRange] = useState<string>('all')
  const [tempSalesRange, setTempSalesRange] = useState<string>('all')
  const [tempSortBy, setTempSortBy] = useState<'rank' | 'trending-up' | 'trending-down'>('rank')

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

  // Save scroll position and filters before navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem('trending_scroll_position', window.scrollY.toString())
      sessionStorage.setItem('trending_filters', JSON.stringify({
        selectedReportId,
        platform,
        category,
        commissionRange,
        salesRange,
        searchQuery,
        sortBy,
        favoritesOnly
      }))
    }

    // Save scroll position periodically while scrolling
    const handleScroll = () => {
      sessionStorage.setItem('trending_scroll_position', window.scrollY.toString())
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [selectedReportId, platform, category, commissionRange, salesRange, searchQuery, sortBy, favoritesOnly])

  // Restore scroll position and filters when returning to page (only on mount)
  useEffect(() => {
    const returnTimestamp = sessionStorage.getItem('trending_return_timestamp')
    const savedFilters = sessionStorage.getItem('trending_filters')

    // Only restore if we're returning from navigation (has timestamp within last 10 seconds)
    if (!returnTimestamp) return
    const timeDiff = Date.now() - parseInt(returnTimestamp, 10)
    if (timeDiff > 10000) {
      // Clear stale data
      sessionStorage.removeItem('trending_return_timestamp')
      sessionStorage.removeItem('trending_scroll_position')
      sessionStorage.removeItem('trending_filters')
      return
    }

    // Restore filters immediately
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters)
        if (filters.selectedReportId) setSelectedReportId(filters.selectedReportId)
        if (filters.platform !== undefined) setPlatform(filters.platform)
        if (filters.category) setCategory(filters.category)
        if (filters.commissionRange) setCommissionRange(filters.commissionRange)
        if (filters.salesRange) setSalesRange(filters.salesRange)
        if (filters.searchQuery !== undefined) setSearchQuery(filters.searchQuery)
        if (filters.sortBy) setSortBy(filters.sortBy)
        if (filters.favoritesOnly !== undefined) setFavoritesOnly(filters.favoritesOnly)
      } catch (e) {
        console.warn('Failed to restore filters:', e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount - intentionally ignoring deps

  // Additional scroll restoration after products load
  useEffect(() => {
    if (!loading && products.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('trending_scroll_position')
      const returnTimestamp = sessionStorage.getItem('trending_return_timestamp')
      
      if (savedScrollPosition && returnTimestamp) {
        const scrollPosition = parseInt(savedScrollPosition, 10)
        const timeDiff = Date.now() - parseInt(returnTimestamp, 10)
        
        // Only restore if we returned within the last 5 seconds
        if (timeDiff < 5000) {
          const scrollTimer = setTimeout(() => {
            window.scrollTo({
              top: scrollPosition,
              behavior: 'instant'
            })
            sessionStorage.removeItem('trending_scroll_position')
            sessionStorage.removeItem('trending_return_timestamp')
          }, 100)
          
          return () => clearTimeout(scrollTimer)
        }
      }
    }
  }, [loading, products.length])

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
        <div className="max-w-7xl px-4 sm:px-8 mx-auto">
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
          <div className="flex items-start justify-between bg-white px-4 sm:px-6 py-4 sm:py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trending Products</h1>
              <p className="text-sm text-gray-500 mt-1">Updated weekly based on TikTok&apos;s top sellers</p>
            </div>

            {/* Date Range Selector - Hidden on mobile */}
            {reportsError ? (
              <div className="text-sm text-red-600 hidden sm:block">{reportsError}</div>
            ) : reports.length === 0 ? (
              <div className="text-sm text-gray-500 hidden sm:block">No reports available</div>
            ) : (
              <div className="hidden sm:block">
                <DateRangeSelector
                  reports={reports}
                  selectedReportId={selectedReportId}
                  onValueChange={(value) => {
                    if (value && value.trim() !== '') {
                      setSelectedReportId(value)
                    }
                  }}
                  placeholder="Select date range"
                />
              </div>
            )}
          </div>

          {/* Mobile: Platform Toggle, Date Range, and Filter Buttons */}
          <div className="px-4 sm:hidden space-y-3 mb-4">
            {/* Platform Selection Toggle - Mobile */}
            <div className="flex flex-row items-start p-1 gap-[10px] w-full h-9 bg-[#F5F6F7] border border-[#ECECEC] rounded-xl">
              <button
                onClick={() => setPlatform(platform === 'tiktok' ? null : 'tiktok')}
                className={`flex flex-col justify-center items-center cursor-pointer px-[14px] py-[6px] gap-[10px] flex-1 h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  platform === 'tiktok'
                    ? 'bg-white'
                    : 'bg-transparent hover:bg-white/50'
                }`}
              >
                <div className="flex flex-row items-center p-0 gap-[6px]">
                  <i className="fab fa-tiktok text-[17px] text-black" aria-hidden="true"></i>
                  <span className="text-sm font-medium text-black whitespace-nowrap">TikTok</span>
                </div>
              </button>

              <button
                onClick={() => setPlatform(platform === 'amazon' ? null : 'amazon')}
                className={`flex flex-col justify-center items-center cursor-pointer px-[14px] py-[6px] gap-[10px] flex-1 h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  platform === 'amazon'
                    ? 'bg-white'
                    : 'bg-transparent hover:bg-white/50'
                }`}
              >
                <div className="flex flex-row items-center p-0 gap-[6px]">
                  <i className="fab fa-amazon text-[17px] text-[#FF9900]" aria-hidden="true"></i>
                  <span className="text-sm font-medium text-black whitespace-nowrap">Amazon</span>
                </div>
              </button>
            </div>

            {/* Date Range and Action Buttons Row */}
            <div className="flex items-center gap-3">
              {/* Date Range Selector - Mobile */}
              {!reportsError && reports.length > 0 && (
                <div className="flex-1">
                  <DateRangeSelector
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onValueChange={(value) => {
                      if (value && value.trim() !== '') {
                        setSelectedReportId(value)
                      }
                    }}
                    placeholder="Select date range"
                    className="w-full"
                  />
                </div>
              )}
              
              {/* Favorites Only Button - Mobile */}
              <button
                onClick={() => {
                  setFavoritesOnly(!favoritesOnly)
                }}
                className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                  favoritesOnly
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <Heart className={`w-5 h-5 ${favoritesOnly ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              </button>
              
              {/* Filter Button - Mobile */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // Sync current filter values to temp state when opening
                  setTempPlatform(platform)
                  setTempCategory(category)
                  setTempCommissionRange(commissionRange)
                  setTempSalesRange(salesRange)
                  setTempSortBy(sortBy)
                  setIsFilterOpen(true)
                }}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white flex items-center gap-2 text-sm font-medium text-gray-900 hover:border-gray-300 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Filter Bar Section - Desktop */}
          <div className="hidden sm:block px-6 space-y-4">
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

          {/* Mobile Filter Modal */}
          {isMounted && (
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetContent 
                side="bottom" 
                className="h-[90vh] rounded-t-2xl p-0 flex flex-col max-w-full sm:hidden z-[100001] [&>button]:hidden"
              >
              <SheetHeader className="px-6 pt-6 pb-4 border-b relative">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <Input
                    type="search"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 bg-white rounded-xl border border-gray-200 pr-4 pl-10 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 hover:border-gray-300 placeholder:text-gray-400"
                  />
                </div>

                {/* Platform Selection Toggle - Mobile */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Platform</label>
                  <div className="flex flex-row items-start p-1 gap-[10px] w-full h-9 bg-[#F5F6F7] border border-[#ECECEC] rounded-xl">
                    <button
                      onClick={() => setTempPlatform(tempPlatform === 'tiktok' ? null : 'tiktok')}
                      className={`flex flex-col justify-center items-start cursor-pointer px-[14px] py-[6px] gap-[10px] flex-1 h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                        tempPlatform === 'tiktok'
                          ? 'bg-white'
                          : 'bg-transparent hover:bg-white/50'
                      }`}
                    >
                      <div className="flex flex-row items-center p-0 gap-[6px]">
                        <i className="fab fa-tiktok text-[17px] text-black" aria-hidden="true"></i>
                        <span className="text-sm font-medium text-black whitespace-nowrap">TikTok</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setTempPlatform(tempPlatform === 'amazon' ? null : 'amazon')}
                      className={`flex flex-col justify-center items-start cursor-pointer px-[14px] py-[6px] gap-[10px] flex-1 h-7 shadow-[0px_1px_3px_rgba(0,0,0,0.05)] rounded-[10px] border-none transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                        tempPlatform === 'amazon'
                          ? 'bg-white'
                          : 'bg-transparent hover:bg-white/50'
                      }`}
                    >
                      <div className="flex flex-row items-center p-0 gap-[6px]">
                        <i className="fab fa-amazon text-[17px] text-[#FF9900]" aria-hidden="true"></i>
                        <span className="text-sm font-medium text-black whitespace-nowrap">Amazon</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Category Dropdown */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Category</label>
                  <Select value={tempCategory} onValueChange={(value) => {
                    console.log('[FILTER MODAL] Category changed to:', value)
                    setTempCategory(value)
                  }}>
                    <SelectTrigger className="w-full h-10 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg z-[100002]">
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
                </div>

                {/* Commission Rate Dropdown */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Commission Rate</label>
                  <Select value={tempCommissionRange} onValueChange={(value) => {
                    console.log('[FILTER MODAL] Commission range changed to:', value)
                    setTempCommissionRange(value)
                  }}>
                    <SelectTrigger className="w-full h-10 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue placeholder="Commission Rate" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg z-[100002]">
                      <SelectItem value="all">All Rates</SelectItem>
                      <SelectItem value="0-5">0% - 5%</SelectItem>
                      <SelectItem value="5-10">5% - 10%</SelectItem>
                      <SelectItem value="10-15">10% - 15%</SelectItem>
                      <SelectItem value="15-20">15% - 20%</SelectItem>
                      <SelectItem value="20-100">20%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* TikTok 7-Day Sales Dropdown */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Tik Tok-7 Days Sale</label>
                  <Select value={tempSalesRange} onValueChange={(value) => {
                    console.log('[FILTER MODAL] Sales range changed to:', value)
                    setTempSalesRange(value)
                  }}>
                    <SelectTrigger className="w-full h-10 bg-white rounded-xl border border-gray-200 text-sm font-medium text-gray-900 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0">
                      <SelectValue placeholder="Tik Tok-7 Days Sale" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg z-[100002]">
                      <SelectItem value="all">All Sales</SelectItem>
                      <SelectItem value="0-1000">0 - 1,000</SelectItem>
                      <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                      <SelectItem value="5000-10000">5,000 - 10,000</SelectItem>
                      <SelectItem value="10000-50000">10,000 - 50,000</SelectItem>
                      <SelectItem value="50000-999999999">50,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trending Up/Down Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setTempSortBy(tempSortBy === 'trending-up' ? 'rank' : 'trending-up')}
                    className={`flex-1 h-10 rounded-xl border pt-[14px] pr-4 pb-3 pl-4 flex items-center justify-between gap-2 text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                      tempSortBy === 'trending-up'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <span>Trending Up</span>
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => setTempSortBy(tempSortBy === 'trending-down' ? 'rank' : 'trending-down')}
                    className={`flex-1 h-10 rounded-xl border pt-[14px] pr-4 pb-3 pl-4 flex items-center justify-between gap-2 text-sm font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                      tempSortBy === 'trending-down'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <span>Trending Down</span>
                    <TrendingDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Apply/Reset Buttons */}
              <div className="px-6 pb-6 pt-4 border-t flex gap-3">
                <Button
                  onClick={() => {
                    setPlatform(tempPlatform)
                    setCategory(tempCategory)
                    setCommissionRange(tempCommissionRange)
                    setSalesRange(tempSalesRange)
                    setSortBy(tempSortBy)
                    setIsFilterOpen(false)
                  }}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                >
                  Apply
                </Button>
                <Button
                  onClick={() => {
                    setTempPlatform(null)
                    setTempCategory('all')
                    setTempCommissionRange('all')
                    setTempSalesRange('all')
                    setTempSortBy('rank')
                    setPlatform(null)
                    setCategory('all')
                    setCommissionRange('all')
                    setSalesRange('all')
                    setSortBy('rank')
                    setIsFilterOpen(false)
                  }}
                  variant="outline"
                  className="flex-1 h-11 border-gray-200 text-gray-900 rounded-xl font-medium hover:bg-gray-50"
                >
                  Reset
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          )}

          {/* Product Grid Section */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-4 sm:mt-8 mb-8 px-4 sm:px-0">
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
                  amazonUrl={product.amazonUrl}
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
