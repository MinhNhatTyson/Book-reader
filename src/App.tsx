import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Library from './pages/Library'
import Reader from './pages/Reader'
import Sync from './pages/Sync'
import Bookmarks from './pages/Bookmarks'
import Data from './pages/Data'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/sync" element={<Sync />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/data" element={<Data />} />
      </Routes>
    </>
  )
}