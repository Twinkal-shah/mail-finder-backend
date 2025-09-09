import { DashboardLayout } from '@/components/dashboard-layout'
import { getProfileData } from '@/lib/profile'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  
  // If no user found, redirect to auth
  if (!user) {
    redirect('/auth/login')
  }
  
  const profile = await getProfileData(user.id)
  
  // If no profile found, redirect to auth
  if (!profile) {
    redirect('/auth/login')
  }
  
  const userProfile = {
    full_name: profile.full_name || profile.email?.split('@')[0] || 'User',
    credits: (profile.credits_find || 0) + (profile.credits_verify || 0),
    email: profile.email,
    company: profile.company,
    plan: profile.plan,
    plan_expiry: profile.plan_expiry,
    credits_find: profile.credits_find,
    credits_verify: profile.credits_verify
  }

  return (
    <DashboardLayout userProfile={userProfile}>
      {children}
    </DashboardLayout>
  )
}