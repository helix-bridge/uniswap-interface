const BLOCKED_PATHS = ['/buy']

export function isPathBlocked(pathname: string) {
  const blockedPaths = document.querySelector('meta[property="x:blocked-paths"]')?.getAttribute('content')?.split(',')
  return BLOCKED_PATHS.includes(pathname) || (blockedPaths?.includes(pathname) ?? false)
}
