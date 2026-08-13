export interface DailyStatistic {
  date: string
  averageBpm: number
  minBpm: number
  maxBpm: number
  totalMeasurements: number
  normalMeasurements: number
  abnormalMeasurements: number
}

export interface DailyStatisticsQuery {
  from: string
  to: string
}