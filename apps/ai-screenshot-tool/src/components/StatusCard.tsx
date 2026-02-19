type StatusCardProps = {
  title: string
  value: string
}

export const StatusCard = ({ title, value }: StatusCardProps) => (
  <article className="status-card">
    <h2>{title}</h2>
    <p>{value}</p>
  </article>
)
