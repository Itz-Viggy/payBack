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
import DraftReview from './pages/DraftReview'

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'status', element: <Status /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'processing/:billId?', element: <Processing /> },
      // Resume flow MUST be listed before :billId so "analysis" isn't swallowed as a billId
      { path: 'results/analysis/:analysisId', element: <Results /> },
      // New-bill flow: /results/:billId (in-memory bill from upload)
      { path: 'results/:billId', element: <Results /> },
      { path: 'dispute/:caseId?', element: <Dispute /> },
      { path: 'send/:caseId?', element: <Send /> },
      // Resume-draft flow: /draft/:analysisId
      { path: 'draft/:analysisId', element: <DraftReview /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

