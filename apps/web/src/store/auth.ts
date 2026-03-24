export const getAuth = () => {
  const raw = localStorage.getItem('auth')
  return raw ? JSON.parse(raw) : null
}
