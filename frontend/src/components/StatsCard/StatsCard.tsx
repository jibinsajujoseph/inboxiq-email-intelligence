type StatsCardProps = {
  label: string
  value: string
  tone: 'sun' | 'mint' | 'ink' | 'rose'
}

export function StatsCard({ label, value, tone }: StatsCardProps) {
  return (
    <article className={`stats-card stats-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}
