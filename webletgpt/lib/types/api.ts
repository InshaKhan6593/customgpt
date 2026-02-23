export type ApiListQueryParams = {
  page?: number
  limit?: number
  sort?: "newest" | "popular" | "rating"
  category?: string
}

export type WebletCapabilities = {
  webSearch?: boolean
  codeInterpreter?: boolean
  imageGen?: boolean
  fileSearch?: boolean
}

export type RsilGovernance = {
  frequency: "realtime" | "daily" | "weekly"
  thresholdScore: number
  autoDeploy: boolean
}
