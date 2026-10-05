import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Library from './pages/Library'
import Reader from './pages/Reader'
import Sync from './pages/Sync'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/sync" element={<Sync />} />
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </>
  )
}