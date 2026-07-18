// 좌측 메뉴. 계약 목록 · 신규 검토 요청 · 검색 세 가지.
// 지금 단계에서는 '계약 목록'만 실제로 동작하고, 나머지는 다음 단계에서 붙인다.
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  const items = [
    { to: '/contracts', label: '계약 목록' },
    { to: '/contracts/new', label: '신규 검토 요청' },
    { to: '/search', label: '검색' },
  ]
  return (
    <div style={styles.side}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          style={({ isActive }) => ({
            ...styles.item,
            ...(isActive ? styles.active : {}),
          })}
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  )
}

const styles = {
  side: { width: 160, flexShrink: 0, borderRight: '1px solid #e7e5e4', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'sans-serif' },
  item: { display: 'block', fontSize: 13, padding: '8px 10px', borderRadius: 8, color: '#57534e', textDecoration: 'none' },
  active: { background: '#eef2ff', color: '#4338ca' },
}
