import { useState } from 'react'
import { getLastSync, getToken, setToken, syncLibrary } from '../lib/sync'
import './Sync.css'
const PUBLIC_URL = 'https://book-reader.minhnhat0132.workers.dev'

// Opening /sync#token=... (the "phone link") stores the token automatically
function initialToken() {
  const m = location.hash.match(/token=([\w-]+)/)
  if (m) {
    setToken(m[1])
    history.replaceState(null, '', location.pathname)
    return m[1]
  }
  return getToken()
}

export default function Sync() {
  const [token, setTok] = useState(initialToken)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(getLastSync())
  const connected = token.trim() !== '' && token.trim() === getToken()

  async function save() {
    setToken(token)
    if (!token.trim()) {
      setStatus('Disconnected. Your books stay on this device.')
      return
    }
    setBusy(true)
    setStatus('Syncing… the first upload of a big book can take a minute.')
    try {
      await syncLibrary()
      setLast(getLastSync())
      setStatus('Connected ✓ Your library is in sync.')
    } catch (e) {
      console.error('Sync failed:', e)
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(
        msg.startsWith('401') ? 'Wrong token.'
        : /^\d{3} /.test(msg) ? `Server returned an error: ${msg}`
        : `No connection to the server: ${msg}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${PUBLIC_URL}/sync#token=${getToken()}`)
    setStatus('Phone link copied. Send it to your phone and open it there to connect.')
  }

  return (
    <main className="page sync">
      <h1>Cloud sync</h1>
      <p>Paste your access token to keep your library, chapters and reading position in sync across devices.</p>
      <input
        type="password"
        placeholder="Access token"
        autoComplete="off"
        value={token}
        onChange={(e) => setTok(e.target.value)}
      />
      <div className="sync-actions">
        <button onClick={save} disabled={busy}>{token.trim() ? 'Save & sync now' : 'Disconnect'}</button>
        {connected && <button className="secondary" onClick={copyLink}>Copy phone link</button>}
      </div>
      {status && <p className="status">{status}</p>}
      {last > 0 && <p className="meta">Last sync: {new Date(last).toLocaleString()}</p>}
    </main>
  )
}