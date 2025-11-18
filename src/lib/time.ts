export const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes === 0 ? `${hours}h ago` : `${hours}h ${remainingMinutes}m ago`
}
