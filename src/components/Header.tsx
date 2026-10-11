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
        <svg
          className="brand-icon"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <rect width="32" height="32" rx="8" fill="#2a3142" />
          <path
            d="M6 11c3.3-.9 6.5-.2 10 1.7v12c-3.2-1.7-6.5-2.3-10-1.4V11Z"
            fill="#f6f3ec"
            stroke="#d9c7a6"
            strokeLinejoin="round"
          />
          <path
            d="M16 12.7c3.4-1.9 6.7-2.6 10-1.7v12.3c-3.5-.9-6.8-.3-10 1.4v-12Z"
            fill="#f6f3ec"
            stroke="#d9c7a6"
            strokeLinejoin="round"
          />
          <path
            d="M16 12.8v11.8"
            fill="none"
            stroke="#c58a45"
            strokeLinecap="round"
            strokeWidth="1.4"
          />
          <path
            d="M19.5 11.2c-.2-3.5 2.1-6.3 6.8-7.2.1 4.4-1.8 6.8-6.8 7.2Z"
            fill="#9dbb83"
            stroke="#d9c7a6"
            strokeLinejoin="round"
            strokeWidth=".7"
          />
          <path
            d="M19.8 10.8c1.5-1.8 3.1-3.1 4.9-4.3"
            fill="none"
            stroke="#f6f3ec"
            strokeLinecap="round"
            strokeWidth=".7"
          />
          <path
            d="m8.5 14.5 4.5.4m-4.5 3 4.5.4m6.1-3.8 3.8-.4"
            fill="none"
            stroke="#2a3142"
            strokeLinecap="round"
            strokeWidth=".7"
            opacity=".55"
          />
          <path
            d="m27 11 .5 1.1 1.1.5-1.1.5L27 14.2l-.5-1.1-1.1-.5 1.1-.5L27 11Z"
            fill="#e7bd69"
          />
        </svg>
       <span className="brand-text">Leaflight</span></NavLink>
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
        {!inReader && (
          <NavLink to="/bookmarks" className={({ isActive }) => (isActive ? 'active' : '')}>
            🔖<span className="hide-sm"> Bookmarks</span>
          </NavLink>
        )}
        {!inReader && (
          <NavLink to="/data" className={({ isActive }) => (isActive ? 'active' : '')}>
            Data
          </NavLink>
        )}
        {lastRead && !inReader && <NavLink to={`/read/${lastRead}`}>Continue<span className="hide-sm"> reading</span></NavLink>}
        {inReader && (
          <>
            <button onClick={() => setUI({ chaptersOpen: true })} aria-label="Chapters">☰<span className="hide-sm"> Chapters</span></button>
            <button onClick={() => setUI({ searchOpen: true })} aria-label="Search">🔍<span className="hide-sm"> Search</span></button>
            <button onClick={() => setUI({ bookmarksOpen: true })} aria-label="Bookmarks">🔖<span className="hide-sm"> Bookmarks</span></button>
            <button onClick={() => setUI({ settingsOpen: true })} aria-label="Settings">Aa<span className="hide-sm"> Settings</span></button>
          </>
        )}
      </nav>
    </header>
  )
}