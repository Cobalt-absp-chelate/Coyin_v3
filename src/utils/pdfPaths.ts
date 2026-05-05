export function resolvePdfPath(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/')
    ? relativePath.substring(1)
    : relativePath
  return `/${cleanPath}`
}
