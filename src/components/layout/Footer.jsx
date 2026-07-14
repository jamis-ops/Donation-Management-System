import { Link } from 'react-router-dom'
import { Globe, Mail, Share2 } from 'lucide-react'
import { foundation } from '../../data/mockData'
import Logo from '../shared/Logo'

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
          <div className="site-footer__social">
            <a href={foundation.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
              <Share2 size={18} />
            </a>
            <a href={foundation.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
              <Globe size={18} />
            </a>
            <a href={foundation.social.twitter} target="_blank" rel="noreferrer" aria-label="Twitter">
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
              <a href={`tel:${foundation.phone}`}>{foundation.phone}</a>
            </p>
            <p>
              <a href={`mailto:${foundation.email}`}>{foundation.email}</a>
            </p>
          </address>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} {foundation.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
