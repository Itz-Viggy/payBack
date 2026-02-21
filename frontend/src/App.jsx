/**
 * App.jsx
 * Root layout and route definitions for PayBack.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Upload from './pages/Upload'
import Results from './pages/Results'
import Dispute from './pages/Dispute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/results/:billId?" element={<Results />} />
        <Route path="/dispute/:caseId?" element={<Dispute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
