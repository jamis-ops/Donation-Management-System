import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getHomeForRole } from '../../utils/roleRoutes'
import Logo from '../shared/Logo'

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/#about', label: 'About Us', hash: true },
  { to: '/#programs', label: 'Programs', hash: true },
  { to: '/stories', label: 'Success Stories' },
  { to: '/#partners', label: 'Partners', hash: true },
  { to: '/contact', label: 'Contact Us' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, isAuthenticated } = useAuth()

  const handleNavClick = (link) => {
    setMenuOpen(false)
    if (link.hash && window.location.pathname === '/') {
      const id = link.to.split('#')[1]
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo onClick={() => setMenuOpen(false)} />

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>

        <nav className={`site-nav ${menuOpen ? 'site-nav--open' : ''}`}>
          <ul className="site-nav__links">
            {navLinks.map((link) => (
              <li key={link.label}>
                {link.hash ? (
                  <a
                    href={link.to}
                    className="site-nav__link"
                    onClick={(e) => {
                      if (window.location.pathname !== '/') return
                      e.preventDefault()
                      handleNavClick(link)
                    }}
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `site-nav__link${isActive ? ' site-nav__link--active' : ''}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>

          <div className="site-nav__actions">
            <Link to="/volunteer" className="btn btn--outline btn--sm" onClick={() => setMenuOpen(false)}>
              Volunteer
            </Link>
            {isAuthenticated ? (
              <Link
                to={getHomeForRole(user?.role)}
                className="btn btn--primary btn--sm"
                onClick={() => setMenuOpen(false)}
              >
                My Portal
              </Link>
            ) : (
              <Link to="/login" className="btn btn--ghost-dark btn--sm" onClick={() => setMenuOpen(false)}>
                Log In
              </Link>
            )}
            <Link to="/donate" className="btn btn--accent btn--sm" onClick={() => setMenuOpen(false)}>
              Give
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
