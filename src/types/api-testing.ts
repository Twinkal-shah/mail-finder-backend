export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface HeaderPair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface ApiRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HeaderPair[]
  body: string
  timestamp: number
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
  duration: number // Request duration in milliseconds
}

export interface RequestHistory {
  request: ApiRequest
  response: ApiResponse | null
  error: string | null
  timestamp: number
}

export interface PredefinedEndpoint {
  name: string
  method: HttpMethod
  url: string
  description: string
  headers?: HeaderPair[]
  body?: string
}

export interface ApiTestingState {
  currentRequest: ApiRequest
  response: ApiResponse | null
  isLoading: boolean
  error: string | null
  history: RequestHistory[]
  selectedHistoryId: string | null
}

export interface RequestValidationError {
  field: string
  message: string
}