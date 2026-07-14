import { Link } from 'react-router-dom'
import { contentItems } from '../../data/adminMockData'
import { programs, successStories, partners, announcements } from '../../data/mockData'
import PageHeader from '../../components/admin/shared/PageHeader'

export default function ContentPage() {
  const sections = [
    {
      title: 'Programs',
      count: contentItems.programs,
      description: 'Manage active foundation programs displayed on the public site.',
      items: programs.map((p) => p.name),
      action: 'Manage Programs',
    },
    {
      title: 'Success Stories',
      count: contentItems.stories,
      description: 'Edit impact stories and beneficiary testimonials.',
      items: successStories.map((s) => s.title),
      action: 'Manage Stories',
    },
    {
      title: 'Partners & Sponsors',
      count: contentItems.partners,
      description: 'Update partner logos, descriptions, and categories.',
      items: partners.map((p) => p.name),
      action: 'Manage Partners',
    },
    {
      title: 'Announcements',
      count: contentItems.announcements,
      description: 'Publish news, activities, and volunteer opportunities.',
      items: announcements.map((a) => a.title),
      action: 'Manage Announcements',
    },
  ]

  return (
    <>
      <PageHeader
        title="Website Content"
        description="Manage public website content — programs, stories, partners, and announcements."
      />

      <div className="content-grid">
        {sections.map((section) => (
          <section key={section.title} className="content-card">
            <div className="content-card__header">
              <h2>{section.title}</h2>
              <span className="content-card__count">{section.count} items</span>
            </div>
            <p>{section.description}</p>
            <ul className="content-card__list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="content-card__actions">
              <button type="button" className="btn btn--primary">{section.action}</button>
              <button type="button" className="btn btn--outline">+ Add New</button>
            </div>
          </section>
        ))}
      </div>

      <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
        <h2>Preview Public Site</h2>
        <p>Changes made here will reflect on the public website once saved.</p>
        <Link to="/" className="btn btn--outline" target="_blank">
          Open Public Site ↗
        </Link>
      </div>
    </>
  )
}
