export interface DailyStatistic {
  date: string
  measurementCount?: number
  averageBpm?: number | null
  minBpm?: number | null
  maxBpm?: number | null
  averageSpo2?: number | null
}

export interface DailyStatisticsQuery {
  from: string
  to: string
}