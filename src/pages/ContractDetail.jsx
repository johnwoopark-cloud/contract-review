// 계약 상세 화면 (방식 A: 별도 전체 페이지).
//  - 상단: 계약명 + 상태 배지 + '목록으로'
//  - 역할·상태에 따른 액션 버튼 (이번 단계: 변호사 '검토하기')
//  - 본문: history 날짜별 세로 타임라인, 항목 클릭 시 인라인 확장(관련 파일 + 코멘트)

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { getFileUrl } from '../lib/storage'

const STATUS_LABEL = {
  draft: '요청 준비', lawyer_reviewing: '변호사 검토', client_reviewing: '의뢰자 검토',
  final_agreed: '최종 합의', internal_approval: '내부 기안', sealing: '기안 완료·날인', completed: '최종 완료',
}
const EVENT_LABEL = {
  review_requested: '검토 요청', review_done: '변호사 검토 완료',
  draft_ready: '기안 준비 완료', redraft_request: '기안 중 재검토 요청',
  redraft_done: '기안 중 재검토 완료', drafted: '기안 완료', sealed: '날인 완료',
}
const KIND_LABEL = { request: '요청본', revision: '수정본', draft_ready: '기안준비본', drafted: '기안완료본', sealed: '날인본' }

function dayOf(ts) { return new Date(ts).toISOString().slice(0, 10) }
function timeOf(ts) { return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) }

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [contract, setContract] = useState(null)
  const [events, setEvents] = useState([])
  const [files, setFiles] = useState([])
  const [comments, setComments] = useState([])
  const [openId, setOpenId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const c = await supabase.from('contracts')
        .select('*, owner:owner_id ( name, department, team )').eq('id', id).single()
      if (c.error) { setError(c.error.message); setLoading(false); return }
      setContract(c.data)
      const h = await supabase.from('history').select('*').eq('contract_id', id).order('created_at', { ascending: true })
      setEvents(h.data ?? [])
      const f = await supabase.from('files').select('*').eq('contract_id', id).order('created_at', { ascending: true })
      setFiles(f.data ?? [])
      const cm = await supabase.from('comments').select('*').eq('contract_id', id).order('created_at', { ascending: true })
      setComments(cm.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function openFile(path) {
    try { window.open(await getFileUrl(path), '_blank') }
    catch (e) { alert('파일 열기 오류: ' + e.message) }
  }

  if (loading) return <p style={st.msg}>불러오는 중…</p>
  if (error) return <p style={st.msg}>오류: {error}</p>
  if (!contract) return <p style={st.msg}>계약을 찾을 수 없습니다.</p>

  const byDay = {}
  for (const ev of events) { (byDay[dayOf(ev.created_at)] ??= []).push(ev) }
  const days = Object.keys(byDay).sort()

  // 이번 단계 액션: 변호사이고 상태가 변호사 검토면 '검토하기'
  const canReview = profile?.role === 'lawyer' && contract.status === 'lawyer_reviewing'

  return (
    <div style={st.wrap}>
      <div style={st.head}>
        <button style={st.back} onClick={() => navigate('/contracts')}>← 목록으로</button>
        <span style={st.title}>{contract.title}</span>
        <span style={st.badge}>
          {STATUS_LABEL[contract.status] ?? contract.status}
          {contract.current_round > 0 ? ` (${contract.current_round}차)` : ''}
        </span>
        <span style={{ flex: 1 }} />
        {canReview && (
          <button style={st.action} onClick={() => navigate(`/contracts/${id}/review`)}>검토하기</button>
        )}
      </div>

      <div style={st.meta}>
        상대방: {contract.counterparty ?? '-'} · 의뢰자: {contract.owner?.name ?? '-'} ({contract.owner?.department ?? '-'})
      </div>

      {days.length === 0 ? (
        <p style={st.msg}>아직 이력이 없습니다.</p>
      ) : (
        <div style={st.timeline}>
          {days.map((d) => (
            <div key={d} style={{ marginBottom: 16 }}>
              <div style={st.dayLabel}>{d}</div>
              {byDay[d].map((ev) => {
                const round = ev.detail?.round
                const open = openId === ev.id
                // 검토 완료 이벤트면 그 라운드의 코멘트를 함께 보여준다
                const showComments = ev.event === 'review_done'
                return (
                  <div key={ev.id} style={st.item}>
                    <button style={st.itemHead} onClick={() => setOpenId(open ? null : ev.id)}>
                      <span style={st.time}>{timeOf(ev.created_at)}</span>
                      <span style={st.evName}>{EVENT_LABEL[ev.event] ?? ev.event}{round ? ` (${round}차)` : ''}</span>
                      <span style={st.chev}>{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div style={st.detail}>
                        <div style={st.detailTitle}>관련 파일</div>
                        {files.length === 0 ? <div style={st.dim}>파일 없음</div> : files.map((f) => (
                          <div key={f.id} style={st.fileRow}>
                            <span>{contract.title}_V{f.version} · {KIND_LABEL[f.kind] ?? f.kind} · {f.format.toUpperCase()}</span>
                            <button style={st.dl} onClick={() => openFile(f.storage_path)}>열기</button>
                          </div>
                        ))}
                        {showComments && comments.length > 0 && (
                          <>
                            <div style={{ ...st.detailTitle, marginTop: 10 }}>코멘트</div>
                            {comments.map((c) => (
                              <div key={c.id} style={st.commentRow}>
                                {c.clause_ref && <span style={st.clauseTag}>{c.clause_ref}</span>}
                                <span>{c.body}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const st = {
  wrap: { padding: '16px 20px', fontFamily: 'sans-serif' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 500 },
  badge: { background: '#eef2ff', color: '#4338ca', fontSize: 11, padding: '3px 9px', borderRadius: 20 },
  action: { border: 'none', background: '#1c1917', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' },
  meta: { fontSize: 12, color: '#78716c', marginBottom: 16 },
  timeline: { borderLeft: '2px solid #e7e5e4', paddingLeft: 14, marginLeft: 4 },
  dayLabel: { fontSize: 12, color: '#a8a29e', margin: '0 0 6px' },
  item: { marginBottom: 6 },
  itemHead: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#f5f5f4', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' },
  time: { fontSize: 11, color: '#78716c', minWidth: 38 },
  evName: { fontSize: 13, flex: 1 },
  chev: { fontSize: 9, color: '#a8a29e' },
  detail: { padding: '8px 12px 4px', fontSize: 12 },
  detailTitle: { color: '#78716c', marginBottom: 6 },
  dim: { color: '#a8a29e' },
  fileRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', color: '#44403c' },
  dl: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  commentRow: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' },
  clauseTag: { flexShrink: 0, background: '#eef2ff', color: '#4338ca', borderRadius: 4, padding: '1px 6px', fontSize: 11 },
}
