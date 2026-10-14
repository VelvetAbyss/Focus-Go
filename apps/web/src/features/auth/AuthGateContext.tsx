/* eslint-disable react-refresh/only-export-components */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useIsLoggedIn } from '../../store/auth'
import { isLocalhostRuntime } from '../../shared/env/localhost'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'

const LoginModal = lazy(() => import('../../app/layout/LoginModal'))

type AuthGateContextValue = {
  /**
   * True when auth enforcement is active (not logged in AND not on localhost).
   * Use this to conditionally render lock icons / disabled states.
   */
  isGated: boolean
  /**
   * Wrap any write action with this.
   * – On localhost → always runs the action (dev bypass).
   * – Logged in     → always runs the action.
   * – Guest on prod → shows the login modal; action is NOT run.
   */
  requireAuth: (action: () => void) => void
}

const AuthGateContext = createContext<AuthGateContextValue>({
  isGated: false,
  requireAuth: (action) => action(),
})

export const AuthGateProvider = ({ children }: { children: ReactNode }) => {
  const isLoggedIn = useIsLoggedIn()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [expired, setExpired] = useState(false)

  // Signed out while this device still holds an account's data: the session expired or was
  // revoked (signing out on purpose clears the data). Keep the data and ask for sign-in, once.
  useEffect(() => {
    if (isLoggedIn || isLocalhostRuntime()) return
    let owned = false
    try {
      owned = Boolean(localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY))
    } catch {
      owned = false
    }
    if (!owned) return
    setExpired(true)
    setShowLoginModal(true)
  }, [isLoggedIn])

  const isGated = !isLocalhostRuntime() && !isLoggedIn

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!isGated) {
        action()
      } else {
        setShowLoginModal(true)
      }
    },
    [isGated],
  )

  return (
    <AuthGateContext.Provider value={{ isGated, requireAuth }}>
      {children}
      {showLoginModal && (
        <Suspense fallback={null}>
          <LoginModal reason={expired && !isLoggedIn ? 'expired' : undefined} onClose={() => setShowLoginModal(false)} />
        </Suspense>
      )}
    </AuthGateContext.Provider>
  )
}

export const useAuthGate = () => useContext(AuthGateContext)
