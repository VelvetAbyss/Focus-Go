import { useSearchParams } from 'react-router-dom'
import ZipFocusApp from '../zip/App'

const FocusPage = () => {
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('taskId')

  return (
    <section className="focus-page focus-page--zip-bleed" data-coachmark-anchor="focus-page">
      {!taskId ? (
        <div className="pointer-events-none absolute left-6 top-5 z-10 rounded-full border border-[#3A3733]/10 bg-[#F5F3F0]/92 px-4 py-2 text-xs font-medium tracking-[0.02em] text-[#3A3733]/72 shadow-[0_10px_28px_rgba(58,55,51,0.08)]">
          从 Tasks 进入时，可以把这次专注和一件真实任务连起来。
        </div>
      ) : null}
      <div className="focus-page__content">
        <ZipFocusApp />
      </div>
    </section>
  )
}

export default FocusPage
