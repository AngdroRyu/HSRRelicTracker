export type LoggedSubStat = {
  stat: string
  value: number | string | null
}

export type LoggedRelic = {
  date: string
  domain: string
  set: string
  slot: string
  mainStat: string
  subStats: LoggedSubStat[]
}
