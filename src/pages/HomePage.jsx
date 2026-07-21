import HeroSection from '../components/home/HeroSection'
import HomeCarousel from '../components/home/HomeCarousel'
import AboutSection from '../components/home/AboutSection'
import ProgramsSection from '../components/home/ProgramsSection'
import AnnouncementsSection from '../components/home/AnnouncementsSection'
import StatsSection from '../components/home/StatsSection'
import ImpactMapSection from '../components/home/ImpactMapSection'
import PartnersSection from '../components/home/PartnersSection'

export default function HomePage() {
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
