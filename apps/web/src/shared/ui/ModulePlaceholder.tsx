type ModulePlaceholderProps = {
  title: string
  description: string
}

const ModulePlaceholder = ({ title, description }: ModulePlaceholderProps) => {
  return (
    <section className="module-placeholder">
      <div className="module-placeholder__content">
        <p className="module-placeholder__eyebrow">Module</p>
        <h1 className="module-placeholder__title">{title}</h1>
        <p className="module-placeholder__description">{description}</p>
      </div>
    </section>
  )
}

export default ModulePlaceholder
