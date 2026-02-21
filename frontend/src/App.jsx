import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

// Layout
import DashboardLayout from './layouts/DashboardLayout'

// Dashboard Pages
import Home from './pages/Home'
import Status from './pages/Status'
import HistoryPage from './pages/HistoryPage'

// Flow Pages (existing)
import Processing from './pages/Processing'
import Results from './pages/Results'
import Dispute from './pages/Dispute'
import Send from './pages/Send'
import SimilarCases from './pages/SimilarCases'

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'status', element: <Status /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'processing/:billId?', element: <Processing /> },
      { path: 'results/:billId?', element: <Results /> },
      { path: 'dispute/:caseId?', element: <Dispute /> },
      { path: 'send/:caseId?', element: <Send /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

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
