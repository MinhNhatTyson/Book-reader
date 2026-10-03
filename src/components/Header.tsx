import { NavLink, useLocation } from 'react-router-dom'
import { setUI, useUI } from '../lib/uiStore'
import './Header.css'

// To add a new feature later: add one entry to this array.
const links = [
  { to: '/', label: 'Library' },
]

export default function Header() {
  const { pathname } = useLocation()
  const inReader = pathname.startsWith('/read/')
  const { headerHidden } = useUI()
  const lastRead = localStorage.getItem('last-read')
  return (
    <header className={`site-header${headerHidden ? ' hidden' : ''}`}>
      <NavLink to="/" className="brand">📖 Notebook Reader</NavLink>
      <nav>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
        {lastRead && !inReader && <NavLink to={`/read/${lastRead}`}>Continue reading</NavLink>}
        {inReader && (
          <>
            <button onClick={() => setUI({ chaptersOpen: true })}>☰ Chapters</button>
            <button onClick={() => setUI({ settingsOpen: true })}>Aa Settings</button>
          </>
        )}
      </nav>
    </header>
  )
}