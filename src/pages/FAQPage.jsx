import { useEffect, useState } from 'react'
import { faqCategories as mockFaqs } from '../data/mockData'
import { fetchPublishedContent } from '../api/resources'

function groupFaqs(items) {
  const map = new Map()
  for (const item of items) {
    const category = item.meta?.category || 'General'
    if (!map.has(category)) map.set(category, [])
    map.get(category).push({
      q: item.title,
      a: item.body || item.summary || '',
    })
  }
  return Array.from(map.entries()).map(([name, faqItems]) => ({ name, items: faqItems }))
}

export default function FAQPage() {
  const [categories, setCategories] = useState(mockFaqs)
  const [openIndex, setOpenIndex] = useState(null)
  let globalIndex = 0

  useEffect(() => {
    let cancelled = false
    fetchPublishedContent('faqs', []).then((items) => {
      if (cancelled) return
      if (items.length > 0 && items[0]?.title) {
        setCategories(groupFaqs(items))
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="page">
      <section className="page-hero">
        <div className="container">
          <h1>Frequently Asked Questions</h1>
          <p>Find answers about donations, volunteering, assistance, and more.</p>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          {categories.map((category) => (
            <div key={category.name} className="faq-category">
              <h2>{category.name}</h2>
              <div className="faq-list">
                {category.items.map((item) => {
                  const idx = globalIndex++
                  const isOpen = openIndex === idx
                  return (
                    <div
                      key={item.q}
                      className={`faq-item${isOpen ? ' faq-item--open' : ''}`}
                    >
                      <button
                        type="button"
                        className="faq-item__question"
                        aria-expanded={isOpen}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                      >
                        {item.q}
                        <span className="faq-item__icon" aria-hidden="true">+</span>
                      </button>
                      <div className="faq-item__answer-wrap" aria-hidden={!isOpen}>
                        <div className="faq-item__answer">{item.a}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
