import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole } from '../../utils/roleRoutes'
import Logo from '../shared/Logo'

const navLinks = [
  { id: 'home', to: '/', label: 'Home', end: true },
  { id: 'about', to: '/about', label: 'About Us' },
  { id: 'programs', to: '/#programs', label: 'Projects', hash: true, section: 'programs' },
  { id: 'stories', to: '/stories', label: 'Success Stories' },
  { id: 'partners', to: '/#partners', label: 'Partners', hash: true, section: 'partners' },
  { id: 'contact', to: '/contact', label: 'Contact Us' },
]

function getActiveNavId(pathname, hashSection) {
  if (pathname.startsWith('/about')) return 'about'
  if (pathname.startsWith('/stories')) return 'stories'
  if (pathname.startsWith('/contact')) return 'contact'
  if (pathname.startsWith('/projects')) return 'programs'
  if (pathname.startsWith('/volunteer') || pathname.startsWith('/donate') || pathname.startsWith('/assistance') || pathname.startsWith('/faq')) {
    return null
  }
  if (pathname === '/' || pathname === '') {
    if (hashSection === 'programs') return 'programs'
    if (hashSection === 'partners') return 'partners'
    return 'home'
  }
  return null
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hashSection, setHashSection] = useState('')
  const { pathname } = useLocation()
  const { user, isAuthenticated } = useAuth()
  const activeId = getActiveNavId(pathname, hashSection)

  useEffect(() => {
    if (pathname !== '/') {
      setHashSection('')
      return undefined
    }

    const pickSection = () => {
      const marker = window.scrollY + Math.min(220, window.innerHeight * 0.28)
      const programs = document.getElementById('programs')
      const partners = document.getElementById('partners')

      const inView = (el) => {
        if (!el) return false
        const top = el.offsetTop
        const bottom = top + el.offsetHeight
        return marker >= top && marker < bottom
      }

      if (inView(partners)) {
        setHashSection('partners')
        return
      }
      if (inView(programs)) {
        setHashSection('programs')
        return
      }
      if (window.scrollY < 160) {
        setHashSection('')
      }
    }

    pickSection()
    window.addEventListener('scroll', pickSection, { passive: true })
    window.addEventListener('resize', pickSection)
    return () => {
      window.removeEventListener('scroll', pickSection)
      window.removeEventListener('resize', pickSection)
    }
  }, [pathname])

  const handleHashClick = (link, e) => {
    setMenuOpen(false)
    if (pathname === '/') {
      e.preventDefault()
      const id = link.section
      setHashSection(id)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      window.history.replaceState(null, '', `/#${id}`)
    }
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo showText onClick={() => setMenuOpen(false)} />

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>

        <nav className={`site-nav${menuOpen ? ' site-nav--open' : ''}`} aria-label="Main navigation">
          <ul className="site-nav__links">
            {navLinks.map((link) => {
              const isActive = activeId === link.id
              return (
                <li key={link.id}>
                  {link.hash ? (
                    <a
                      href={link.to}
                      className={`site-nav__link${isActive ? ' site-nav__link--active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(e) => handleHashClick(link, e)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <NavLink
                      to={link.to}
                      end={link.end}
                      className={() => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </NavLink>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="site-nav__actions">
            <Link
              to="/volunteer"
              className="btn btn--ghost-dark btn--sm"
              onClick={() => setMenuOpen(false)}
            >
              Volunteer
            </Link>

            {isAuthenticated ? (
              <Link
                to={getHomeForRole(user?.role)}
                className="btn btn--outline btn--sm"
                onClick={() => setMenuOpen(false)}
              >
                My Portal
              </Link>
            ) : (
              <Link
                to="/login"
                className="btn btn--ghost-dark btn--sm"
                onClick={() => setMenuOpen(false)}
              >
                Log In
              </Link>
            )}

            <Link
              to="/donate"
              className="btn btn--primary btn--sm"
              onClick={() => setMenuOpen(false)}
            >
              Donate Now
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
