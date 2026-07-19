// 알림 벨. 상단 바에 표시.
//  - 안 읽은 알림 개수를 뱃지로 보여준다.
//  - 클릭하면 최근 알림 목록(드롭다운)이 열린다.
//  - 알림을 클릭하면 해당 계약 상세로 이동하고 읽음 처리한다.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'

export default function NotificationBell() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const unread = items.filter((n) => !n.is_read).length

  async function load() {
    if (!session) return
    const { data } = await supabase.from('notifications')
      .select('*').eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false }).limit(20)
    setItems(data ?? [])
  }

  useEffect(() => {
    load()
    // 30초마다 새 알림 확인 (간단 폴링)
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // 바깥 클릭하면 닫기
  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function openItem(n) {
    // 읽음 처리
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    }
    setOpen(false)
    if (n.contract_id) {
      const q = n.round ? `?round=${n.round}` : ''
      navigate(`/contracts/${n.contract_id}${q}`)
    }
  }

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setItems((xs) => xs.map((x) => ({ ...x, is_read: true })))
  }

  function timeText(ts) {
    return new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div style={s.wrap} ref={boxRef}>
      <button style={s.bell} onClick={() => setOpen((v) => !v)}>
        🔔
        {unread > 0 && <span style={s.badge}>{unread}</span>}
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.panelHead}>
            <span>알림</span>
            {unread > 0 && <button style={s.markAll} onClick={markAllRead}>모두 읽음</button>}
          </div>
          {items.length === 0 ? (
            <div style={s.empty}>알림이 없습니다.</div>
          ) : (
            items.map((n) => (
              <button key={n.id} style={{ ...s.item, ...(n.is_read ? {} : s.itemUnread) }} onClick={() => openItem(n)}>
                <div style={s.itemTitle}>{n.title}</div>
                <div style={s.itemTime}>{timeText(n.created_at)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { position: 'relative' },
  bell: { position: 'relative', border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 },
  badge: { position: 'absolute', top: -2, right: -4, background: '#dc2626', color: '#fff', fontSize: 10, minWidth: 15, height: 15, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' },
  panel: { position: 'absolute', right: 0, top: 30, width: 300, maxHeight: 380, overflowY: 'auto', background: '#fff', border: '1px solid #e7e5e4', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.10)', zIndex: 50 },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #f0efed', fontSize: 13, fontWeight: 500 },
  markAll: { border: 'none', background: 'transparent', color: '#4338ca', fontSize: 12, cursor: 'pointer' },
  empty: { padding: '18px 12px', color: '#a8a29e', fontSize: 13, textAlign: 'center' },
  item: { display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #f5f5f4', background: '#fff', padding: '10px 12px', cursor: 'pointer' },
  itemUnread: { background: '#f5f7ff' },
  itemTitle: { fontSize: 12.5, color: '#292524', lineHeight: 1.4, marginBottom: 3 },
  itemTime: { fontSize: 11, color: '#a8a29e' },
}
