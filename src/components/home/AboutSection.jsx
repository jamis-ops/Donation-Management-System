import { foundation } from '../../data/mockData'
import SectionHeading from '../shared/SectionHeading'

const goals = [
  'Deliver rapid disaster relief within 48 hours of activation',
  'Sponsor education for 1,000 students annually',
  'Operate sustainable feeding programs in 20 barangays',
  'Conduct quarterly medical missions in underserved areas',
  'Build community resilience through skills training and outreach',
]

export default function AboutSection() {
  return (
    <section id="about" className="section about-section">
      <div className="container">
        <SectionHeading
          eyebrow="About Us"
          title="A foundation built on compassion and action"
          description="Founded by community leaders in Cebu, Rise Above Foundation has grown into a trusted partner for relief, development, and hope."
        />
        <div className="about-section__grid">
          <div className="about-section__card">
            <h3>Our Mission</h3>
            <p>{foundation.mission}</p>
          </div>
          <div className="about-section__card">
            <h3>Our Vision</h3>
            <p>{foundation.vision}</p>
          </div>
          <div className="about-section__card about-section__card--wide">
            <h3>Organizational Goals</h3>
            <ul>
              {goals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
