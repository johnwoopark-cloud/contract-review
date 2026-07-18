// 상단 바. 로그인한 사람의 부서·성명과 로그아웃 버튼을 보여준다.
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'

export default function TopBar() {
  const { profile } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={styles.bar}>
      <span style={styles.brand}>계약 사전검토</span>
      <div style={styles.right}>
        <span>
          {profile ? `${profile.department ?? ''} · ${profile.name ?? profile.email}` : ''}
        </span>
        <span style={styles.sep}>|</span>
        <button style={styles.logout} onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  )
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e7e5e4', fontFamily: 'sans-serif' },
  brand: { fontSize: 14, fontWeight: 500 },
  right: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#57534e' },
  sep: { color: '#d6d3d1' },
  logout: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
}
