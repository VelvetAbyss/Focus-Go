import type { CrmStage } from '../../data/models/crm'

/** Stable identity colors help a customer remain recognizable across views. */
export function CustomerAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const tone = [...name].reduce((sum, char) => sum + char.codePointAt(0)!, 0) % 5
  const initials = /[\u3400-\u9fff]/.test(name) ? [...name].slice(0, 1).join('') : name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className={`crm-avatar ${large ? 'crm-avatar--large' : ''}`} data-tone={tone} aria-hidden="true">{initials}</span>
}

export function StageChip({ stage, children }: { stage: CrmStage; children: React.ReactNode }) {
  return <span className="crm-stage-chip" data-stage={stage}><i aria-hidden="true" />{children}</span>
}
