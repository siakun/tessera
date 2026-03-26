/**
 * 중앙 API 클라이언트.
 *
 * - request(): 기본 HTTP 요청 함수 (에러 핸들링 통합)
 * - coreApi: Core 엔드포인트 (플러그인 목록 등)
 * - pluginApi(): 플러그인별 API factory — 각 플러그인 hook에서 사용
 */

async function request(url, options = {}) {
  const { body, ...rest } = options
  const config = { ...rest }

  if (body !== undefined) {
    config.method = config.method || 'POST'
    config.headers = { 'Content-Type': 'application/json', ...config.headers }
    config.body = JSON.stringify(body)
  }

  const res = await fetch(url, config)

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `요청 실패 (${res.status})`)
  }

  return res.json()
}

// Core API
export const coreApi = {
  getPlugins: () => request('/api/plugins'),
  health: () => request('/health'),
}

// Plugin API factory
export function pluginApi(pluginId) {
  const prefix = `/api/plugins/${pluginId}`
  return {
    get: (path) => request(`${prefix}${path}`),
    post: (path, body) => request(`${prefix}${path}`, { method: 'POST', body }),
  }
}
