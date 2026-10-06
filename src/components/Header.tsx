import { NavLink, useLocation } from 'react-router-dom'
import { setUI, useUI } from '../lib/uiStore'
import './Header.css'

// To add a new feature later: add one entry to this array.
const links = [
  { to: '/', label: 'Library' },
  { to: '/sync', label: 'Sync' },
]

export default function Header() {
  const { pathname } = useLocation()
  const inReader = pathname.startsWith('/read/')
  const { headerHidden } = useUI()
  const lastRead = localStorage.getItem('last-read')
  return (
    <header className={`site-header${headerHidden ? ' hidden' : ''}`}>
      <NavLink to="/" className="brand"> 
        <img src="/favicon.svg" alt="" className="brand-icon" />
       <span className="brand-text">Notebook Reader</span></NavLink>
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
        {lastRead && !inReader && <NavLink to={`/read/${lastRead}`}>Continue<span className="hide-sm"> reading</span></NavLink>}
        {inReader && (
          <>
            <button onClick={() => setUI({ chaptersOpen: true })} aria-label="Chapters">☰<span className="hide-sm"> Chapters</span></button>
            <button onClick={() => setUI({ settingsOpen: true })} aria-label="Settings">Aa<span className="hide-sm"> Settings</span></button>
          </>
        )}
      </nav>
    </header>
  )
}