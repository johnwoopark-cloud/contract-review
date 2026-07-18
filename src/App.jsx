// 앱의 뼈대. 서비스명 문구는 TopBar.jsx / Login.jsx 에 있다.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import ContractList from './pages/ContractList'
import NewRequest from './pages/NewRequest'
import ContractDetail from './pages/ContractDetail'
import LawyerReview from './pages/LawyerReview'
import ClientResubmit from './pages/ClientResubmit'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'

function AppShell() {
  return (
    <div>
      <TopBar />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 45px)' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Routes>
            <Route path="/contracts" element={<ContractList />} />
            <Route path="/contracts/new" element={<NewRequest />} />
            <Route path="/contracts/:id" element={<ContractDetail />} />
            <Route path="/contracts/:id/review" element={<LawyerReview />} />
            <Route path="/contracts/:id/resubmit" element={<ClientResubmit />} />
            <Route path="/search" element={<Placeholder title="검색 (다음 단계)" />} />
            <Route path="*" element={<Navigate to="/contracts" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function Placeholder({ title }) {
  return <p style={{ padding: '16px 20px', color: '#78716c', fontFamily: 'sans-serif', fontSize: 13 }}>{title}</p>
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ padding: 24, fontFamily: 'sans-serif' }}>불러오는 중…</p>
  return session ? <AppShell /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  )
}
