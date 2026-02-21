import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Upload from './pages/Upload'
import Processing from './pages/Processing'
import Results from './pages/Results'
import Dispute from './pages/Dispute'
import Send from './pages/Send'
import SimilarCases from './pages/SimilarCases'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/processing/:billId?" element={<Processing />} />
        <Route path="/results/:billId?" element={<Results />} />
        <Route path="/results/:billId/similar-cases" element={<SimilarCases />} />
        <Route path="/dispute/:caseId?" element={<Dispute />} />
        <Route path="/send/:caseId?" element={<Send />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
