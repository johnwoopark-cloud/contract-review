// 계약 상세 화면 (방식 A: 별도 전체 페이지).
//  - 상단: 계약명 + 상태 배지 + '목록으로'
//  - 본문: history 를 날짜 기준 세로 타임라인으로 표시
//  - 각 항목 클릭 → 그 자리에서 세부(관련 파일 목록·다운로드)가 펼쳐짐(인라인 확장)
//
// 지금 단계는 '보기'에 집중한다. 검토하기/재검토 요청 같은 액션 버튼은 다음 단계에서 붙인다.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
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
const KIND_LABEL = {
  request: '요청본', revision: '수정본', draft_ready: '기안준비본', drafted: '기안완료본', sealed: '날인본',
}

// 'YYYY-MM-DD' 로 자르기 (날짜 그룹용)
function dayOf(ts) { return new Date(ts).toISOString().slice(0, 10) }
function timeOf(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [events, setEvents] = useState([])
  const [files, setFiles] = useState([])
  const [openId, setOpenId] = useState(null) // 펼쳐진 타임라인 항목
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const c = await supabase.from('contracts')
        .select('*, owner:owner_id ( name, department, team )').eq('id', id).single()
      if (c.error) { setError(c.error.message); setLoading(false); return }
      setContract(c.data)

      const h = await supabase.from('history')
        .select('*').eq('contract_id', id).order('created_at', { ascending: true })
      setEvents(h.data ?? [])

      const f = await supabase.from('files')
        .select('*').eq('contract_id', id).order('created_at', { ascending: true })
      setFiles(f.data ?? [])

      setLoading(false)
    }
    load()
  }, [id])

  async function openFile(storagePath) {
    try {
      const url = await getFileUrl(storagePath)
      window.open(url, '_blank')
    } catch (e) {
      alert('파일을 여는 중 오류: ' + e.message)
    }
  }

  if (loading) return <p style={s.msg}>불러오는 중…</p>
  if (error) return <p style={s.msg}>오류: {error}</p>
  if (!contract) return <p style={s.msg}>계약을 찾을 수 없습니다.</p>

  // 날짜별로 이벤트 묶기
  const byDay = {}
  for (const ev of events) {
    const d = dayOf(ev.created_at)
    ;(byDay[d] ??= []).push(ev)
  }
  const days = Object.keys(byDay).sort()

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <button style={s.back} onClick={() => navigate('/contracts')}>← 목록으로</button>
        <span style={s.title}>{contract.title}</span>
        <span style={s.badge}>
          {STATUS_LABEL[contract.status] ?? contract.status}
          {contract.current_round > 0 ? ` (${contract.current_round}차)` : ''}
        </span>
      </div>

      <div style={s.meta}>
        상대방: {contract.counterparty ?? '-'} · 의뢰자: {contract.owner?.name ?? '-'} ({contract.owner?.department ?? '-'})
      </div>

      {days.length === 0 ? (
        <p style={s.msg}>아직 이력이 없습니다.</p>
      ) : (
        <div style={s.timeline}>
          {days.map((d) => (
            <div key={d} style={{ marginBottom: 16 }}>
              <div style={s.dayLabel}>{d}</div>
              {byDay[d].map((ev) => {
                // 이 이벤트가 남긴 라운드와 관련된 파일들(같은 라운드 or 시간 근처)
                const round = ev.detail?.round
                const relatedFiles = files.filter((f) => {
                  // 간단 매칭: 같은 라운드 번호가 파일에 없으므로, 요청/검토 이벤트엔 해당 시점 파일을 느슨히 연결
                  return true // 지금은 전체 파일을 세부에서 보여주고, 다음 단계에서 라운드 정밀 매칭
                })
                const open = openId === ev.id
                return (
                  <div key={ev.id} style={s.item}>
                    <button style={s.itemHead} onClick={() => setOpenId(open ? null : ev.id)}>
                      <span style={s.time}>{timeOf(ev.created_at)}</span>
                      <span style={s.evName}>
                        {EVENT_LABEL[ev.event] ?? ev.event}{round ? ` (${round}차)` : ''}
                      </span>
                      <span style={s.chev}>{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div style={s.detail}>
                        <div style={s.detailTitle}>관련 파일</div>
                        {relatedFiles.length === 0 ? (
                          <div style={s.dim}>파일 없음</div>
                        ) : (
                          relatedFiles.map((f) => (
                            <div key={f.id} style={s.fileRow}>
                              <span>
                                {contract.title}_V{f.version} · {KIND_LABEL[f.kind] ?? f.kind} · {f.format.toUpperCase()}
                              </span>
                              <button style={s.dl} onClick={() => openFile(f.storage_path)}>열기</button>
                            </div>
                          ))
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

const s = {
  wrap: { padding: '16px 20px', fontFamily: 'sans-serif' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 500 },
  badge: { background: '#eef2ff', color: '#4338ca', fontSize: 11, padding: '3px 9px', borderRadius: 20 },
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
}
