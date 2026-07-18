// 로그인 화면. 이메일+비밀번호로 Supabase 에 로그인한다.
// 로그인 성공하면 AuthContext 의 세션이 바뀌고, 앱이 자동으로 목록 화면으로 넘어간다.

import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('로그인 실패: ' + error.message)
    setBusy(false)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>계약 사전검토</h1>
        <p style={styles.sub}>로그인</p>
        <form onSubmit={handleLogin}>
          <label style={styles.label}>이메일</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />
          <label style={styles.label}>비밀번호</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={busy}>
            {busy ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f4', fontFamily: 'sans-serif' },
  card: { width: 320, background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '28px 24px' },
  title: { fontSize: 18, fontWeight: 500, margin: 0 },
  sub: { fontSize: 13, color: '#78716c', margin: '4px 0 20px' },
  label: { display: 'block', fontSize: 12, color: '#57534e', margin: '12px 0 4px' },
  input: { width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14 },
  button: { width: '100%', height: 40, marginTop: 20, border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 12, marginTop: 12 },
}
