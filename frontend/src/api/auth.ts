import { ApiError } from './client'

// ===== 认证状态 =====

let _userToken: string | null = null
let _userRecord: any = null
let _userEmail: string | null = null

const CONFIG = {
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || '',
}

// ===== 持久化 =====

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem('geo_auth')
    if (raw) {
      const data = JSON.parse(raw)
      _userToken = data.token || null
      _userRecord = data.record || null
      _userEmail = data.email || null
    }
  } catch { /* ignore */ }
}
loadAuthFromStorage()

function saveAuthToStorage() {
  if (_userToken && _userRecord) {
    localStorage.setItem('geo_auth', JSON.stringify({
      token: _userToken,
      record: _userRecord,
      email: _userEmail,
    }))
  } else {
    localStorage.removeItem('geo_auth')
  }
}

// ===== 公开方法 =====

export function isLoggedIn(): boolean {
  return !!_userToken && !!_userRecord
}

export function getCurrentUserId(): string | null {
  return _userRecord ? _userRecord.id : null
}

export function getCurrentUserEmail(): string | null {
  return _userRecord ? _userRecord.email : null
}

export function getCurrentUserName(): string | null {
  return _userRecord ? (_userRecord.name || _userRecord.email) : null
}

export function getCurrentUserRecord(): any {
  return _userRecord
}

export async function userLogin(email: string, password: string): Promise<any> {
  const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new ApiError(data.message || '登录失败', res.status)
  _userToken = data.token
  _userRecord = data.record
  _userEmail = email
  saveAuthToStorage()
  return data.record
}

export async function userRegister(email: string, password: string, name?: string): Promise<any> {
  const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      name: name || email.split('@')[0],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data.data ? Object.values(data.data).flat().join('; ') : (data.message || '注册失败')
    throw new ApiError(msg, res.status)
  }
  return await userLogin(email, password)
}

export function logout() {
  _userToken = null
  _userRecord = null
  _userEmail = null
  localStorage.removeItem('geo_auth')
}

// JWT 解码
function decodeJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''))
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || !payload.exp) return false
  return payload.exp < Math.floor(Date.now() / 1000)
}

async function refreshTokenIfNeeded() {
  if (!_userToken) return
  if (isTokenExpired(_userToken)) return
  const payload = decodeJwtPayload(_userToken)
  if (!payload || !payload.exp) return
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = payload.exp - now
  if (expiresIn < 86400) {
    try {
      const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: _userToken,
        },
      })
      if (res.ok) {
        const data = await res.json()
        _userToken = data.token
        _userRecord = data.record
        saveAuthToStorage()
      }
    } catch {
      // 忽略刷新失败
    }
  }
}

export async function getToken(): Promise<string> {
  if (_userToken) {
    if (isTokenExpired(_userToken)) {
      logout()
      throw new ApiError('登录已过期，请重新登录', 401, 'TOKEN_EXPIRED')
    }
    await refreshTokenIfNeeded()
    return _userToken
  }
  throw new ApiError('请先登录', 401, 'NOT_AUTHENTICATED')
}
