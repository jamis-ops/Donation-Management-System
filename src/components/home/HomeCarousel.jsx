import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { carouselSlides } from '../../data/mockData'

const INTERVAL_MS = 5500

export default function HomeCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = carouselSlides.length

  const go = useCallback((next) => {
    setIndex((i) => (next + total) % total)
  }, [total])

  useEffect(() => {
    if (paused || total <= 1) return undefined
    const id = setInterval(() => go(index + 1), INTERVAL_MS)
    return () => clearInterval(id)
  }, [index, paused, go, total])

  if (!total) return null

  return (
    <section
      className="home-carousel"
      aria-roledescription="carousel"
      aria-label="Foundation highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="home-carousel__viewport">
        {carouselSlides.map((slide, i) => (
          <div
            key={slide.id}
            className={`home-carousel__slide${i === index ? ' home-carousel__slide--active' : ''}`}
            aria-hidden={i !== index}
          >
            <img src={slide.src} alt={slide.alt} loading={i === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}

        <div className="home-carousel__scrim" />

        <button
          type="button"
          className="home-carousel__nav home-carousel__nav--prev"
          aria-label="Previous slide"
          onClick={() => go(index - 1)}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          className="home-carousel__nav home-carousel__nav--next"
          aria-label="Next slide"
          onClick={() => go(index + 1)}
        >
          <ChevronRight size={22} />
        </button>

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
            />
          ))}
        </div>
      </div>
    </section>
  )
}
