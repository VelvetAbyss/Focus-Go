import { CheckCircle2, Circle, Mail, Pencil, Phone } from 'lucide-react'
import Dialog from '../../../shared/ui/Dialog'
import Avatar from '../../../shared/ui/Avatar'
import type { ProjectPerson, TaskItem } from '../../../data/models/types'
import { useProjectsI18n } from '../projectsI18n'

const ROLE_COLORS: Record<ProjectPerson['roleType'], string> = {
  owner: '#0D7A54',
  collaborator: '#4F746C',
  reviewer: '#B07830',
  external: '#6B5D8A',
}

type PersonProfileDialogProps = {
  open: boolean
  person: ProjectPerson | null
  linkedTasks: TaskItem[]
  onClose: () => void
  onRequestEdit: () => void
  onOpenTask?: (task: TaskItem) => void
}

const PersonProfileDialog = ({
  open,
  person,
  linkedTasks,
  onClose,
  onRequestEdit,
  onOpenTask,
}: PersonProfileDialogProps) => {
  const i18n = useProjectsI18n()
  if (!person) return null

  const roleColor = ROLE_COLORS[person.roleType]
  const roleLabel = person.roleType.charAt(0).toUpperCase() + person.roleType.slice(1)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="pd-person-profile">
        {/* Gradient banner colored by role */}
        <div
          className="pd-person-profile__banner"
          style={{
            background: `linear-gradient(135deg, ${roleColor} 0%, ${roleColor}cc 70%, ${roleColor}66 100%)`,
          }}
        />
        <div className="pd-person-profile__head">
          <Avatar
            name={person.name}
            blobHash={person.avatarBlobHash}
            seed={person.avatarSeed ?? person.id}
            size={96}
            className="pd-person-profile__avatar"
          />
          <button
            type="button"
            className="pd-person-profile__edit"
            onClick={onRequestEdit}
          >
            <Pencil size={13} />
            {i18n.detail.edit}
          </button>
        </div>

        <div className="pd-person-profile__body">
          <p className="project-dialog__eyebrow">{i18n.dialog.personDetailEyebrow}</p>
          <h2 className="pd-person-profile__name">{person.name}</h2>
          <span
            className="pd-person-profile__role"
            style={{ color: roleColor, background: `${roleColor}1A` }}
          >
            {roleLabel}
          </span>

          <div className="pd-person-profile__contact">
            {person.email ? (
              <a className="pd-person-profile__contact-row" href={`mailto:${person.email}`}>
                <Mail size={14} />
                <span>{person.email}</span>
              </a>
            ) : null}
            {person.phone ? (
              <a className="pd-person-profile__contact-row" href={`tel:${person.phone}`}>
                <Phone size={14} />
                <span>{person.phone}</span>
              </a>
            ) : null}
            {person.note ? (
              <p className="pd-person-profile__note">{person.note}</p>
            ) : null}
          </div>

          <div className="pd-person-profile__tasks">
            <p className="project-dialog__eyebrow">{i18n.dialog.linkedTasks} <span className="pd-count">{linkedTasks.length}</span></p>
            {linkedTasks.length === 0 ? (
              <p className="pd-empty-inline">—</p>
            ) : (
              <ul className="pd-person-profile__task-list">
                {linkedTasks.slice(0, 6).map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="pd-person-profile__task"
                      onClick={() => onOpenTask?.(task)}
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <Circle size={14} className="text-[color:rgba(58,55,51,0.35)]" />
                      )}
                      <span className="pd-person-profile__task-title">{task.title}</span>
                    </button>
                  </li>
                ))}
                {linkedTasks.length > 6 ? (
                  <li className="pd-person-profile__task-more">
                    +{linkedTasks.length - 6}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default PersonProfileDialog
