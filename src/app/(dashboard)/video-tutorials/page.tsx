'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayCircle, Clock, Users } from 'lucide-react'

const tutorials = [
  {
    id: 1,
    title: 'How to automate the email enrichment',
    description: 'Learn how to set up automated email enrichment workflows to enhance your contact data efficiently.',
    duration: '15 min',
    thumbnail: '/api/placeholder/400/225',
    videoUrl: '#', // To be replaced with actual video URL
    category: 'Automation'
  },
  {
    id: 2,
    title: 'How to build a fully automated outbound system',
    description: 'Complete guide to building an end-to-end automated outbound email system for maximum efficiency.',
    duration: '25 min',
    thumbnail: '/api/placeholder/400/225',
    videoUrl: '#', // To be replaced with actual video URL
    category: 'Outbound'
  }
]

export default function VideoTutorialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Video Tutorials</h1>
        <p className="mt-2 text-gray-600">
          Exclusive tutorials for Agency and Lifetime users to maximize your email automation potential.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tutorials.map((tutorial) => (
          <Card key={tutorial.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <div className="relative">
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <PlayCircle className="h-16 w-16 text-gray-400" />
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
                <PlayCircle className="h-16 w-16 text-white opacity-0 hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {tutorial.duration}
              </div>
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{tutorial.title}</CardTitle>
                  <CardDescription className="mt-2">
                    {tutorial.description}
                  </CardDescription>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {tutorial.category}
                </span>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-4">
          <Users className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900">Exclusive Content</h3>
            <p className="text-blue-700 mt-1">
              These video tutorials are exclusively available to Agency and Lifetime plan users. 
              Upgrade your plan to access more advanced features and tutorials.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}