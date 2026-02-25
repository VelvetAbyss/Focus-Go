type AmbientBackgroundProps = {
  immersive: boolean
}

const AmbientBackground = ({ immersive }: AmbientBackgroundProps) => {
  return (
    <div className={`ambient-background ${immersive ? 'is-immersive' : ''}`} aria-hidden>
      <div className="ambient-background__layer ambient-background__layer--one" />
      <div className="ambient-background__layer ambient-background__layer--two" />
    </div>
  )
}

export default AmbientBackground
