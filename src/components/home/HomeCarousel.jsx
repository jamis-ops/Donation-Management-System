import { useCallback, useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { carouselSlides } from '../../data/mockData'

const INTERVAL_MS = 4000

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export default function HomeCarousel() {
  const [index, setIndex] = useState(0)
  const [tabHidden, setTabHidden] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  const reducedMotion = usePrefersReducedMotion()
  const total = carouselSlides.length
  const autoplay = !tabHidden && !reducedMotion && total > 1
  const carouselRef = useRef(null)

  const go = useCallback((next, skipTransition = false) => {
    if (isTransitioning && !skipTransition) return

    setIsTransitioning(true)
    setIndex((i) => (next + total) % total)

    setTimeout(() => {
      setIsTransitioning(false)
    }, 600)
  }, [total, isTransitioning])

  useEffect(() => {
    if (!autoplay) return undefined
    const id = setTimeout(() => go(index + 1), INTERVAL_MS)
    return () => clearTimeout(id)
  }, [index, autoplay, go])

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!carouselRef.current?.contains(document.activeElement)) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          go(index - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          go(index + 1)
          break
        case 'Home':
          e.preventDefault()
          go(0)
          break
        case 'End':
          e.preventDefault()
          go(total - 1)
          break
        default:
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, go, total])

  const handleDragStart = (clientX) => {
    setDragStart(clientX)
    setDragOffset(0)
  }

  const handleDragMove = (clientX) => {
    if (dragStart === null) return
    setDragOffset(clientX - dragStart)
  }

  const handleDragEnd = () => {
    if (dragStart === null) return

    const threshold = 50
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0) {
        go(index - 1)
      } else {
        go(index + 1)
      }
    }

    setDragStart(null)
    setDragOffset(0)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    handleDragStart(e.clientX)
  }

  const handleMouseMove = (e) => {
    handleDragMove(e.clientX)
  }

  const handleMouseUp = () => {
    handleDragEnd()
  }

  const handleTouchStart = (e) => {
    handleDragStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e) => {
    handleDragMove(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    handleDragEnd()
  }

  useEffect(() => {
    if (dragStart === null) return undefined
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragStart, dragOffset])

  if (!total) return null

  return (
    <section
      ref={carouselRef}
      className={`home-carousel${reducedMotion ? ' home-carousel--reduced' : ''}${dragStart !== null ? ' home-carousel--dragging' : ''}`}
      aria-roledescription="carousel"
      aria-label="Foundation highlights"
      tabIndex={0}
    >
      <div
        className="home-carousel__viewport"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragStart !== null ? `translateX(${dragOffset}px)` : 'translateX(0)',
          transition: dragStart !== null ? 'none' : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {carouselSlides.map((slide, i) => {
          const isActive = i === index
          const isPrev = i === (index - 1 + total) % total
          const isNext = i === (index + 1) % total

          return (
            <div
              key={slide.id}
              className={`home-carousel__slide${isActive ? ' home-carousel__slide--active' : ''}${isPrev ? ' home-carousel__slide--prev' : ''}${isNext ? ' home-carousel__slide--next' : ''}`}
              aria-hidden={!isActive}
            >
              <div className="home-carousel__image-wrapper">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading="eager"
                  decoding="async"
                  draggable="false"
                />
                <div className="home-carousel__image-overlay" />
              </div>
            </div>
          )
        })}

        <div className="home-carousel__scrim" />

        <button
          type="button"
          className="home-carousel__nav home-carousel__nav--prev"
          aria-label="Previous slide"
          onClick={() => go(index - 1)}
          disabled={isTransitioning}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="home-carousel__nav home-carousel__nav--next"
          aria-label="Next slide"
          onClick={() => go(index + 1)}
          disabled={isTransitioning}
        >
          <ChevronRight size={24} strokeWidth={2.5} />
        </button>

        <div className="home-carousel__indicators-wrapper">
          <div className="home-carousel__indicators" role="tablist" aria-label="Slide indicators">
            {carouselSlides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                className={`home-carousel__dot${i === index ? ' home-carousel__dot--active' : ''}`}
                onClick={() => setIndex(i)}
                disabled={isTransitioning}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
