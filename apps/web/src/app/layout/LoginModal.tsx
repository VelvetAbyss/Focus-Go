import { X, LogIn, UserPlus, Mail, KeyRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { authClient } from '../../config/authClient'
import { consumePendingCheckout, startPremiumCheckout } from '../../features/payments/paymentFlow'
import { fetchAuthProfile, setAuth } from '../../store/auth'
import { useI18n } from '../../shared/i18n/useI18n'

type LoginModalProps = {
  onClose: () => void
}

type Mode = 'login' | 'signup'

const looksLikeEmail = (value: string) => /\S+@\S+\.\S+/.test(value)

const LoginModal = ({ onClose }: LoginModalProps) => {
  const { language } = useI18n()
  const [mode, setMode] = useState<Mode>('login')
  const [account, setAccount] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const copy = {
    eyebrow: 'Focus & Go',
    title: language === 'zh' ? '登录你的账号' : 'Sign in to your account',
    subtitle: language === 'zh'
      ? '使用邮箱、用户名或 Google 继续。邮箱验证稍后开放。'
      : 'Continue with email, username, or Google. Email verification arrives later.',
    account: language === 'zh' ? '邮箱或用户名' : 'Email or username',
    email: language === 'zh' ? '邮箱' : 'Email',
    username: language === 'zh' ? '用户名' : 'Username',
    name: language === 'zh' ? '显示名称' : 'Display name',
    password: language === 'zh' ? '密码' : 'Password',
    login: language === 'zh' ? '登录' : 'Sign in',
    signup: language === 'zh' ? '创建账号' : 'Create account',
    google: language === 'zh' ? '使用 Google 继续' : 'Continue with Google',
    switchToSignup: language === 'zh' ? '还没有账号？创建一个' : 'No account yet? Create one',
    switchToLogin: language === 'zh' ? '已有账号？登录' : 'Already have an account? Sign in',
    passwordHint: language === 'zh' ? '至少 8 个字符。' : 'At least 8 characters.',
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
        const result = await authClient.signInEmail({ email: account.trim(), password })
        await finishAuth(result.token, result.user)
      } else {
        const result = await authClient.signInUsername({ username: account.trim(), password })
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
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} />
              </div>
              <small>{copy.passwordHint}</small>
            </label>

            {error ? <p className="login-modal__error">{error}</p> : null}

            <button type="submit" className="login-modal__cta" disabled={loading}>
              {mode === 'signup' ? <UserPlus size={14} /> : <LogIn size={14} />}
              {loading ? '...' : (mode === 'signup' ? copy.signup : copy.login)}
            </button>
          </form>

          <button type="button" className="login-modal__google" onClick={() => void handleGoogle()} disabled={loading}>
            <span>G</span>
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

export default LoginModal
