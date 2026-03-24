export function getAuth() {
  const raw = localStorage.getItem('auth')
  return raw ? JSON.parse(raw) : null
}

export function logout() {
  localStorage.removeItem('auth')
  window.location.reload()
}
