import { useState } from 'react'
import { faqCategories } from '../data/mockData'

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null)

  let globalIndex = 0

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
          {faqCategories.map((category) => (
            <div key={category.name} className="faq-category">
              <h2>{category.name}</h2>
              <div className="faq-list">
                {category.items.map((item) => {
                  const idx = globalIndex++
                  const isOpen = openIndex === idx
                  return (
                    <div key={item.q} className={`faq-item${isOpen ? ' faq-item--open' : ''}`}>
                      <button
                        type="button"
                        className="faq-item__question"
                        aria-expanded={isOpen}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                      >
                        {item.q}
                        <span className="faq-item__icon" aria-hidden="true">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      {isOpen && <div className="faq-item__answer">{item.a}</div>}
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
