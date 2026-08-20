import ZipFocusApp from '../zip/App'
import AuthInteractionGate from '../../auth/AuthInteractionGate'

const FocusPage = () => {
  return (
    <section className="focus-page focus-page--zip-bleed">
      <div className="focus-page__content">
        <AuthInteractionGate>
        <ZipFocusApp />
        </AuthInteractionGate>
      </div>
    </section>
  )
}

export default FocusPage
