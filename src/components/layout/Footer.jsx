import { Link } from 'react-router-dom'
import { Globe, Mail, Share2 } from 'lucide-react'
import { foundation } from '../../data/mockData'
import Logo from '../shared/Logo'
import PolicyLinks from '../shared/PolicyLinks'

const footerLinks = [
  {
    title: 'Get Involved',
    links: [
      { to: '/donate', label: 'Donate' },
      { to: '/volunteer', label: 'Volunteer' },
      { to: '/assistance', label: 'Request Assistance' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/#programs', label: 'Projects' },
      { to: '/stories', label: 'Success Stories' },
      { to: '/faq', label: 'FAQ' },
      { to: '/contact', label: 'Contact Us' },
      { to: '/login', label: 'Portal Login' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo to="/" className="brand-logo--footer" />
          <p className="site-footer__tagline">{foundation.tagline}</p>
          <p className="site-footer__hours">{foundation.officeHours}</p>
          <div className="site-footer__social">
            <a href={foundation.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
              <Share2 size={18} />
            </a>
            <a href={foundation.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
              <Globe size={18} />
            </a>
            <a href={`mailto:${foundation.email}`} aria-label="Email">
              <Mail size={18} />
            </a>
          </div>
        </div>

        {footerLinks.map((group) => (
          <div key={group.title} className="site-footer__col">
            <h3>{group.title}</h3>
            <ul>
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="site-footer__col">
          <h3>Contact</h3>
          <address>
            <p>{foundation.address}</p>
            <p>
              <a href={`tel:${foundation.phone.replace(/\s/g, '')}`}>{foundation.phone}</a>
              {' / '}
              <a href={`tel:${foundation.phoneAlt.replace(/\s/g, '')}`}>{foundation.phoneAlt}</a>
            </p>
            <p>
              <a href={`tel:${foundation.mobile.replace(/\s/g, '')}`}>{foundation.mobile}</a>
            </p>
            <p>
              <a href={`mailto:${foundation.email}`}>{foundation.email}</a>
            </p>
          </address>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <p>&copy; {new Date().getFullYear()} {foundation.name}. All rights reserved.</p>
          <p className="site-footer__legal">
            <PolicyLinks connector=" · " />
          </p>
        </div>
      </div>
    </footer>
  )
}
