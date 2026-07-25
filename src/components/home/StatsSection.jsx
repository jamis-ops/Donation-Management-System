import { useEffect, useState } from 'react'
import {
  Coins,
  Users,
  Package,
  UserCheck,
  ClipboardList,
  Building2,
  MapPinned,
} from 'lucide-react'
import { impactStats as mockStats } from '../../data/mockData'
import { fetchPublishedContent } from '../../api/resources'
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver'
import { useCountUp } from '../../hooks/useCountUp'
import SectionHeading from '../shared/SectionHeading'
import Reveal from '../shared/Reveal'

const statIcons = [
  Coins,
  Users,
  Package,
  UserCheck,
  ClipboardList,
  Building2,
  MapPinned,
]

function mapCmsStat(item) {
  const meta = item.meta || {}
  return {
    label: item.title,
    value: meta.value || item.summary || '',
  }
}

function StatCard({ stat, icon: Icon, index, isVisible }) {
  // Extract number from stat value (e.g., "₱1.5M+" -> 1.5, "10,000+" -> 10000)
  const extractNumber = (str) => {
    const cleaned = str.replace(/[^0-9.]/g, '')
    return parseFloat(cleaned) || 0
  }

  // Format the animated count back to match original format
  const formatCount = (count, original) => {
    if (original.includes('M')) {
      return `₱${count.toFixed(1)}M+`
    }
    if (original.includes('K')) {
      return `${count}K+`
    }
    if (original.includes('₱')) {
      return `₱${count.toLocaleString()}+`
    }
    if (original.includes(',')) {
      return `${count.toLocaleString()}+`
    }
    return count.toString()
  }

  const targetNumber = extractNumber(stat.value)
  const animatedCount = useCountUp(targetNumber, 2000, isVisible)
  const displayValue = isVisible ? formatCount(animatedCount, stat.value) : '0'

  return (
    <Reveal 
      className={`stat-card ${isVisible ? 'stat-card--animated' : ''}`}
      delay={Math.min(index * 55, 330)}
    >
      <span className="stat-card__icon-wrapper">
        <span className="stat-card__icon-bg"></span>
        <span className={`stat-card__icon ${isVisible ? 'stat-card__icon--pulse' : ''}`} aria-hidden="true">
          {Icon && <Icon size={24} strokeWidth={2} />}
        </span>
      </span>
      <span className="stat-card__value">{displayValue}</span>
      <span className="stat-card__label">{stat.label}</span>
    </Reveal>
  )
}

export default function StatsSection() {
  const [stats, setStats] = useState(mockStats)
  const [ref, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.2,
  })

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('impact', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setStats(items.map(mapCmsStat))
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <section id="impact" className="section stats-section" ref={ref}>
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Impact Statistics"
            title="Our achievements at a glance"
            description="Transparent metrics reflecting the collective impact of donors, volunteers, and partners."
          />
        </Reveal>
        <div className="stats-grid">
          {stats.map((stat, index) => {
            const Icon = statIcons[index % statIcons.length]
            return (
              <StatCard
                key={stat.label}
                stat={stat}
                icon={Icon}
                index={index}
                isVisible={hasIntersected}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
