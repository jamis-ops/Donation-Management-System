import { useEffect } from 'react'
import HeroSection from '../components/home/HeroSection'
import HomeCarousel from '../components/home/HomeCarousel'
import AboutSection from '../components/home/AboutSection'
import ProgramsSection from '../components/home/ProgramsSection'
import AnnouncementsSection from '../components/home/AnnouncementsSection'
import StatsSection from '../components/home/StatsSection'
import ImpactMapSection from '../components/home/ImpactMapSection'
import PartnersSection from '../components/home/PartnersSection'

export default function HomePage() {
  useEffect(() => {
    // Smooth scroll behavior for anchor links
    document.documentElement.style.scrollBehavior = 'smooth'

    // Handle hash links on page load
    if (window.location.hash) {
      const element = document.querySelector(window.location.hash)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    }

    return () => {
      document.documentElement.style.scrollBehavior = 'auto'
    }
  }, [])

  return (
    <div className="home-page">
      <HeroSection />
      <HomeCarousel />
      <AboutSection />
      <ProgramsSection />
      <AnnouncementsSection />
      <StatsSection />
      <ImpactMapSection />
      <PartnersSection />
    </div>
  )
}
