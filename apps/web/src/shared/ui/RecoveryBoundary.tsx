import { Component, type ReactNode } from 'react'

export default class RecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    const en = !navigator.language.startsWith('zh')
    return <section className="startup-screen" role="alert" data-auth-preview-allowed="true">
      <h1>{en ? 'This page could not be opened' : '页面暂时无法打开'}</h1>
      <p>{en ? 'Reload to try again. Your saved local data will be kept.' : '可以刷新后重试，已保存的本地数据会保留。'}</p>
      <button type="button" onClick={() => window.location.reload()}>{en ? 'Reload' : '刷新重试'}</button>
      <a href="/">{en ? 'Back to workspace' : '返回工作区'}</a>
    </section>
  }
}
