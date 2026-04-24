import { X, LogIn, UserPlus, Mail, KeyRound, Eye, EyeOff } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState, useEffect } from 'react'
import { authClient } from '../../config/authClient'
import { consumePendingCheckout, startPremiumCheckout } from '../../features/payments/paymentFlow'
import { fetchAuthProfile, setAuth } from '../../store/auth'
import { useI18n } from '../../shared/i18n/useI18n'

type LoginModalProps = {
  onClose: () => void
}

type Mode = 'login' | 'signup'

const looksLikeEmail = (value: string) => /\S+@\S+\.\S+/.test(value)

const REMEMBER_KEY = 'fg_remembered_account'

const LoginModal = ({ onClose }: LoginModalProps) => {
  const { language } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [account, setAccount] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_KEY) !== null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Animate in on mount
  useEffect(() => {
    document.querySelector('.login-modal--auth')?.classList.add('is-visible')
  }, [])

  const copy = {
    eyebrow: 'FOCUS & GO',
    title: language === 'zh' ? '登录你的账号' : 'Sign in to your account',
    subtitle: language === 'zh'
      ? '使用邮箱、用户名或 Google 继续。'
      : 'Continue with email, username, or Google.',
    account: language === 'zh' ? '邮箱或用户名' : 'Email or username',
    email: language === 'zh' ? '邮箱' : 'Email',
    username: language === 'zh' ? '用户名' : 'Username',
    name: language === 'zh' ? '显示名称（可选）' : 'Display name (optional)',
    password: language === 'zh' ? '密码' : 'Password',
    login: language === 'zh' ? '登录' : 'Sign in',
    signup: language === 'zh' ? '创建账号' : 'Create account',
    google: language === 'zh' ? '使用 Google 继续' : 'Continue with Google',
    switchToSignup: language === 'zh' ? '还没有账号？创建一个' : 'No account yet? Create one',
    switchToLogin: language === 'zh' ? '已有账号？登录' : 'Already have an account? Sign in',
    passwordHint: language === 'zh' ? '至少 8 个字符。' : 'At least 8 characters.',
    rememberMe: language === 'zh' ? '记住我' : 'Remember me',
    showPassword: language === 'zh' ? '显示密码' : 'Show password',
    hidePassword: language === 'zh' ? '隐藏密码' : 'Hide password',
  }

  const finishAuth = async (token?: string, user?: unknown) => {
    if (!token || !user) throw new Error(language === 'zh' ? '登录响应缺少会话。' : 'Missing session in auth response.')
    const profile = await fetchAuthProfile(token)
    setAuth({ accessToken: token, user, plan: profile?.plan ?? 'free', expiresAt: profile?.expiresAt ?? null, isAdmin: profile?.isAdmin ?? false })
    const pendingCheckout = consumePendingCheckout()
    if (pendingCheckout) {
      await startPremiumCheckout(pendingCheckout)
      return
    }
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp({
          email: email.trim(),
          username: username.trim(),
          name: name.trim() || username.trim() || email.trim(),
          password,
        })
        await finishAuth(result.token, result.user)
      } else if (looksLikeEmail(account.trim())) {
        const result = await authClient.signInEmail({ email: account.trim(), password, rememberMe })
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, account.trim())
        } else {
          localStorage.removeItem(REMEMBER_KEY)
        }
        await finishAuth(result.token, result.user)
      } else {
        const result = await authClient.signInUsername({ username: account.trim(), password })
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, account.trim())
        } else {
          localStorage.removeItem(REMEMBER_KEY)
        }
        await finishAuth(result.token, result.user)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'zh' ? '登录失败。' : 'Sign in failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const result = await authClient.signInGoogle(window.location.origin)
      if (result.url) {
        window.location.href = result.url
        return
      }
      await finishAuth(result.token, result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'zh' ? 'Google 登录失败。' : 'Google sign in failed.'))
      setLoading(false)
    }
  }

  return (
    <div className="login-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal login-modal--auth" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal__close" onClick={onClose} aria-label="Close">
          <X size={13} strokeWidth={2.5} />
        </button>

        <div className="login-modal__content">
          <div className="login-modal__header">
            <p className="login-modal__eyebrow">{copy.eyebrow}</p>
            <h2 className="login-modal__title">{copy.title}</h2>
            <p className="login-modal__subtitle">{copy.subtitle}</p>
          </div>

          <div className="login-modal__tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>
              {copy.login}
            </button>
            <button type="button" className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>
              {copy.signup}
            </button>
          </div>

          <form className="login-modal__form" onSubmit={(event) => void handleSubmit(event)}>
            {mode === 'signup' ? (
              <>
                <label className="login-modal__field">
                  <span>{copy.email}</span>
                  <div>
                    <Mail size={14} />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
                  </div>
                </label>
                <label className="login-modal__field">
                  <span>{copy.username}</span>
                  <div>
                    <UserPlus size={14} />
                    <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required minLength={3} maxLength={30} />
                  </div>
                </label>
                <label className="login-modal__field">
                  <span>{copy.name}</span>
                  <div>
                    <LogIn size={14} />
                    <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                  </div>
                </label>
              </>
            ) : (
              <label className="login-modal__field">
                <span>{copy.account}</span>
                <div>
                  <Mail size={14} />
                  <input value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" required />
                </div>
              </label>
            )}

            <label className="login-modal__field">
              <span>{copy.password}</span>
              <div>
                <KeyRound size={14} />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  className="login-modal__pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {mode === 'signup' && <small>{copy.passwordHint}</small>}
            </label>

            {mode === 'login' && (
              <label className="login-modal__remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{copy.rememberMe}</span>
              </label>
            )}

            {error ? <p className="login-modal__error">{error}</p> : null}

            <button type="submit" className="login-modal__cta" disabled={loading}>
              {loading ? (
                <span className="login-modal__spinner" />
              ) : mode === 'signup' ? (
                <UserPlus size={14} />
              ) : (
                <LogIn size={14} />
              )}
              {loading ? (language === 'zh' ? '请稍候…' : 'Please wait…') : (mode === 'signup' ? copy.signup : copy.login)}
            </button>
          </form>

          <div className="login-modal__divider">
            <span>{language === 'zh' ? '或' : 'or'}</span>
          </div>

          <button type="button" className="login-modal__google" onClick={() => void handleGoogle()} disabled={loading}>
            <GoogleIcon />
            {copy.google}
          </button>

          <button type="button" className="login-modal__switch" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? copy.switchToSignup : copy.switchToLogin}
          </button>
        </div>
      </div>
    </div>
  )
}

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

export default LoginModal
