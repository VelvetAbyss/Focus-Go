import { useCallback, useEffect, useRef, useState, type Key, type ReactNode } from 'react'
import { motion, useInView } from 'motion/react'
import { useMotionPreference } from '../prefs/useMotionPreference'
import './AnimatedScrollList.css'

type AnimatedScrollListProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  getKey?: (item: T, index: number) => Key
  className?: string
  listClassName?: string
  itemClassName?: string
  emptyState?: ReactNode
  showGradients?: boolean
  displayScrollbar?: boolean
  itemDelay?: number
  setListRef?: (node: HTMLDivElement | null) => void
}

type AnimatedItemProps = {
  index: number
  delay: number
  className?: string
  children: ReactNode
}

const AnimatedItem = ({ index, delay, className, children }: AnimatedItemProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const { reduceMotion } = useMotionPreference()
  const staggerDelay = Math.min(index * delay, 0.24)

  return (
    <motion.div
      ref={ref}
      data-index={index}
      className={className}
      layout="position"
      initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
      animate={reduceMotion ? { scale: 1, opacity: 1 } : inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.24,
              delay: staggerDelay,
              ease: [0.22, 1, 0.36, 1],
              layout: {
                type: 'spring',
                stiffness: 420,
                damping: 34,
              },
            }
      }
    >
      {children}
    </motion.div>
  )
}

const AnimatedScrollList = <T,>({
  items,
  renderItem,
  getKey,
  className = '',
  listClassName = '',
  itemClassName = '',
  emptyState = null,
  showGradients = true,
  displayScrollbar = true,
  itemDelay = 0.1,
  setListRef,
}: AnimatedScrollListProps<T>) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [topGradientOpacity, setTopGradientOpacity] = useState(0)
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1)

  const syncGradients = useCallback(() => {
    const node = listRef.current
    if (!node) return

    const { scrollTop, scrollHeight, clientHeight } = node
    setTopGradientOpacity(Math.min(scrollTop / 50, 1))

    const bottomDistance = scrollHeight - (scrollTop + clientHeight)
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1))
  }, [])

  const handleSetRef = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      setListRef?.(node)
    },
    [setListRef]
  )

  useEffect(() => {
    syncGradients()
  }, [syncGradients, items.length])

  useEffect(() => {
    const node = listRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => syncGradients())
    observer.observe(node)
    return () => observer.disconnect()
  }, [syncGradients])

  return (
    <div className={`animated-scroll-list ${className}`}>
      <div
        ref={handleSetRef}
        className={`${listClassName} animated-scroll-list__inner ${displayScrollbar ? '' : 'animated-scroll-list__no-scrollbar'}`}
        onScroll={syncGradients}
      >
        {items.length === 0
          ? emptyState
          : items.map((item, index) => (
              <AnimatedItem key={getKey ? getKey(item, index) : index} index={index} delay={itemDelay} className={itemClassName}>
                {renderItem(item, index)}
              </AnimatedItem>
            ))}
      </div>

      {showGradients ? (
        <>
          <div className="animated-scroll-list__gradient animated-scroll-list__gradient--top" style={{ opacity: topGradientOpacity }} />
          <div
            className="animated-scroll-list__gradient animated-scroll-list__gradient--bottom"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      ) : null}
    </div>
  )
}

export default AnimatedScrollList
