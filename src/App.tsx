import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Library from './pages/Library'
import Reader from './pages/Reader'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </>
  )
}