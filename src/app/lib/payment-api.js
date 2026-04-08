function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

export function getPaymentApiBaseUrl() {
  const configured = trimTrailingSlash(process.env.NEXT_PUBLIC_PAYMENT_API_BASE_URL)
  if (configured) return configured

  if (typeof window !== 'undefined') {
    return trimTrailingSlash(window.location.origin)
  }

  return ''
}

export function buildPaymentApiUrl(pathname) {
  const normalizedPath = String(pathname || '').startsWith('/')
    ? String(pathname || '')
    : `/${String(pathname || '')}`

  const base = getPaymentApiBaseUrl()
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

