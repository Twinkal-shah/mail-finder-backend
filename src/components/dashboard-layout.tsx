'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Users,
  CheckCircle,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Key,
  PlayCircle,
} from 'lucide-react'
import { getProfileDataClient } from '@/lib/profile'
import { OnboardingFlow } from '@/components/onboarding-flow'

interface DashboardLayoutProps {
  children: React.ReactNode
  userProfile: {
    full_name: string | null
    credits: number
    email: string
    company: string | null
    plan: string
    plan_expiry: string | null
    credits_find: number
    credits_verify: number
  }
}

const getNavigation = (userPlan: string) => {
  const baseNavigation = [
    {
      name: 'EMAIL TOOLS',
      items: [
        { name: 'Find', href: '/find', icon: Search },
        { name: 'Bulk finder', href: '/bulk-finder', icon: Users },
        { name: 'Verify', href: '/verify', icon: CheckCircle },
      ],
    },
    {
      name: 'ACCOUNT',
      items: [
        { name: 'Credits & Billing', href: '/credits', icon: CreditCard },
      ],
    },
  ]

  // Add API page for agency or lifetime plan users
  if (userPlan === 'agency' || userPlan === 'lifetime') {
    baseNavigation[1].items.push({ name: 'API', href: '/api', icon: Key })
  }

  // Add Video Tutorials section for agency or lifetime plan users
  if (userPlan === 'agency' || userPlan === 'lifetime') {
    baseNavigation.push({
      name: 'TUTORIALS',
      items: [
        { name: 'Video Tutorials', href: '/video-tutorials', icon: PlayCircle },
      ],
    })
  }

  return baseNavigation
}

export function DashboardLayout({ children, userProfile }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentProfile, setCurrentProfile] = useState(userProfile)
  const pathname = usePathname()
  const router = useRouter()

  // Listen for focus events to refresh profile data when user returns from payment
  useEffect(() => {
    const handleFocus = async () => {
      try {
        const updatedProfile = await getProfileDataClient()
        if (updatedProfile) {
          const newUserProfile = {
            full_name: updatedProfile.full_name || updatedProfile.email?.split('@')[0] || 'User',
            credits: (updatedProfile.credits_find || 0) + (updatedProfile.credits_verify || 0),
            email: updatedProfile.email,
            company: updatedProfile.company,
            plan: updatedProfile.plan,
            plan_expiry: updatedProfile.plan_expiry,
            credits_find: updatedProfile.credits_find,
            credits_verify: updatedProfile.credits_verify
          }
          setCurrentProfile(newUserProfile)
        }
      } catch {
        console.log('Failed to refresh profile data')
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleSignOut = async () => {
    // Mock sign out - redirect to marketing URL
    router.push(`${process.env.NEXT_PUBLIC_MARKETING_URL || 'https://mailsfinder.com'}/login`)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Onboarding Flow */}
      <OnboardingFlow userProfile={currentProfile} />
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <Link href="/find" className="text-xl font-bold text-gray-900">
              MailsFinder
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-8">
            {getNavigation(currentProfile.plan).map((section) => (
              <div key={section.name}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {section.name}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon
                            className={cn(
                              'mr-3 h-5 w-5 flex-shrink-0',
                              isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                            )}
                          />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center space-x-4">
              {/* Credits pill */}
              <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                Credits: {(currentProfile.credits_find || 0) + (currentProfile.credits_verify || 0)}
              </div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <User className="h-5 w-5" />
                    <span className="hidden sm:block">
                      {currentProfile.full_name || currentProfile.email?.split('@')[0] || 'User'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2 text-sm">
                    <div className="font-medium">{currentProfile.full_name || 'User'}</div>
                    <div className="text-gray-500">{currentProfile.email}</div>
                    {currentProfile.company && (
                      <div className="text-gray-500 text-xs">{currentProfile.company}</div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="px-3 py-2 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <span className="capitalize font-medium">{currentProfile.plan}</span>
                    </div>
                    {currentProfile.plan_expiry && (
                      <div className="flex justify-between mt-1">
                        <span>Expires:</span>
                        <span>{new Date(currentProfile.plan_expiry).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Find Credits:</span>
                        <span className="font-medium">{currentProfile.credits_find}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Verify Credits:</span>
                        <span className="font-medium">{currentProfile.credits_verify}</span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}