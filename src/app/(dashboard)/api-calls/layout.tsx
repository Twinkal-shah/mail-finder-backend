import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Testing - MailsFinder Dashboard',
  description: 'Test and debug your API endpoints with a comprehensive testing interface. Send requests, view responses, and manage your API testing workflow.',
  keywords: ['API testing', 'API debugging', 'HTTP requests', 'REST API', 'API development'],
}

export default function ApiCallsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}