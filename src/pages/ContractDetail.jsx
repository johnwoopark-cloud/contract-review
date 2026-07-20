// 계약 상세 화면 (방식 A: 별도 전체 페이지).
// 역할·상태별 액션 버튼 + 라운드별 주고받은 내용(요청 메시지·코멘트)을 양쪽 다 표시.

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const targetRound = searchParams.get('round')  // 알림에서 넘어온 라운드
  const { session, profile } = useAuth()
  const [contract, setContract] = useState(null)
  const [events, setEvents] = useState([])
  const [files, setFiles] = useState([])
  const [comments, setComments] = useState([])
  const [rounds, setRounds] = useState([])
  const [openId, setOpenId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    const r = await supabase.from('review_rounds').select('*').eq('contract_id', id).order('round_no', { ascending: true })
    setRounds(r.data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  // 알림에서 넘어온 라운드가 있으면, 그 라운드의 '검토 완료' 이벤트를 자동으로 펼치고 스크롤한다.
  const targetRef = useRef(null)
  useEffect(() => {
    if (!targetRound || events.length === 0) return
    // 해당 라운드의 이벤트(검토 완료 우선, 없으면 검토 요청) 찾기
    const done = events.find((e) => e.event === 'review_done' && String(e.detail?.round) === String(targetRound))
    const req = events.find((e) => e.event === 'review_requested' && String(e.detail?.round) === String(targetRound))
    const target = done || req
    if (target) {
      setOpenId(target.id)
      // 렌더 후 스크롤
      setTimeout(() => { targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 100)
    }
  }, [targetRound, events])

  async function openFile(path) {
    try { window.open(await getFileUrl(path), '_blank') }
    catch (e) { alert('파일 열기 오류: ' + e.message) }
  }

  async function handleDraftReady() {
    if (!window.confirm('최종 합의로 보고 기안 준비 완료 처리할까요? 이후 내부 기안 단계로 넘어갑니다.')) return
    setBusy(true)
    try {
      await supabase.from('contracts').update({ status: 'internal_approval' }).eq('id', id)
      await supabase.from('history').insert({ contract_id: id, event: 'draft_ready', actor_id: session.user.id, detail: {} })
      if (contract.lawyer_id) {
        const dept = profile?.department ?? ''; const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: id, recipient_id: contract.lawyer_id, type: 'draft_ready',
          title: `[${dept}·${who}] ${contract.title} 기안 준비가 완료되었습니다.`,
        })
      }
      await load()
    } catch (e) { alert('처리 실패: ' + e.message) } finally { setBusy(false) }
  }

  // 내부 기안 완료 → 날인 단계로
  async function handleDrafted() {
    if (!window.confirm('내부 기안을 완료하고 날인 단계로 넘어갈까요?')) return
    setBusy(true)
    try {
      await supabase.from('contracts').update({ status: 'sealing' }).eq('id', id)
      await supabase.from('history').insert({ contract_id: id, event: 'drafted', actor_id: session.user.id, detail: {} })
      if (contract.lawyer_id) {
        const dept = profile?.department ?? ''; const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: id, recipient_id: contract.lawyer_id, type: 'drafted',
          title: `[${dept}·${who}] ${contract.title} 기안이 완료되었습니다.`,
        })
      }
      await load()
    } catch (e) { alert('처리 실패: ' + e.message) } finally { setBusy(false) }
  }

  if (loading) return <p style={st.msg}>불러오는 중…</p>
  if (error) return <p style={st.msg}>오류: {error}</p>
  if (!contract) return <p style={st.msg}>계약을 찾을 수 없습니다.</p>

  const byDay = {}
  for (const ev of events) { (byDay[dayOf(ev.created_at)] ??= []).push(ev) }
  const days = Object.keys(byDay).sort()

  const isOwner = session?.user?.id === contract.owner_id
  const canReview = profile?.role === 'lawyer' && contract.status === 'lawyer_reviewing'
  const canClientAct = isOwner && contract.status === 'client_reviewing'
  const canDrafted = isOwner && contract.status === 'internal_approval'
  const canSeal = isOwner && contract.status === 'sealing'

  // 특정 라운드의 요청 메시지 / 코멘트 찾기
  function roundOf(no) { return rounds.find((r) => r.round_no === no) }
  function commentsOfRound(no) {
    const rd = roundOf(no)
    if (!rd) return []
    // 그 라운드에 연결된 코멘트. round_id 가 없던 과거분은 제외.
    return comments.filter((c) => c.round_id === rd.id)
  }

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
        {canReview && <button style={st.action} onClick={() => navigate(`/contracts/${id}/review`)}>검토하기</button>}
        {canClientAct && (
          <>
            <button style={st.actionLight} onClick={() => navigate(`/contracts/${id}/resubmit`)}>재검토 요청</button>
            <button style={st.action} disabled={busy} onClick={handleDraftReady}>기안 준비 완료</button>
          </>
        )}
        {canDrafted && (
          <button style={st.action} disabled={busy} onClick={handleDrafted}>기안 완료</button>
        )}
        {canSeal && (
          <button style={st.action} onClick={() => navigate(`/contracts/${id}/seal`)}>날인본 업로드</button>
        )}
      </div>

      <div style={st.meta}>
        상대방: {contract.counterparty ?? '-'} · 의뢰자: {contract.owner?.name ?? '-'} ({contract.owner?.department ?? '-'})
      </div>

      {(contract.context_info?.background || contract.context_info?.special_request) && (
        <div style={st.infoWrap}>
          {contract.context_info?.background && (
            <div style={st.infoCard}>
              <div style={st.infoHead}>계약 배경</div>
              <div style={st.infoText}>{contract.context_info.background}</div>
            </div>
          )}
          {contract.context_info?.special_request && (
            <div style={st.infoCard}>
              <div style={st.infoHead}>특별 검토 요청</div>
              <div style={st.infoText}>{contract.context_info.special_request}</div>
            </div>
          )}
        </div>
      )}

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
                const isRequest = ev.event === 'review_requested'
                const isDone = ev.event === 'review_done'
                const rd = round ? roundOf(round) : null
                const reqMsg = rd?.request_msg
                const roundComments = round ? commentsOfRound(round) : []
                const isTarget = openId === ev.id && String(round) === String(targetRound)
                return (
                  <div key={ev.id} style={st.item} ref={isTarget ? targetRef : null}>
                    <button style={{ ...st.itemHead, ...(isTarget ? st.itemTarget : {}) }} onClick={() => setOpenId(open ? null : ev.id)}>
                      <span style={st.time}>{timeOf(ev.created_at)}</span>
                      <span style={st.evName}>{EVENT_LABEL[ev.event] ?? ev.event}{round ? ` (${round}차)` : ''}</span>
                      <span style={st.chev}>{open ? '▲' : '▼'}</span>
                    </button>
                    {open && (
                      <div style={st.detail}>
                        {/* 검토 요청 → 1차는 배경·특별사항(구분 카드), 재요청은 요청 메시지 */}
                        {isRequest && (
                          round === 1 ? (
                            <div style={st.msgBlock}>
                              <span style={{ ...st.who, ...st.whoClient }}>의뢰자</span>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {contract.context_info?.background && (
                                  <div style={st.infoCard}>
                                    <div style={st.infoHead}>계약 배경</div>
                                    <div style={st.infoText}>{contract.context_info.background}</div>
                                  </div>
                                )}
                                {contract.context_info?.special_request && (
                                  <div style={st.infoCard}>
                                    <div style={st.infoHead}>특별 검토 요청</div>
                                    <div style={st.infoText}>{contract.context_info.special_request}</div>
                                  </div>
                                )}
                                {!contract.context_info?.background && !contract.context_info?.special_request && (
                                  <em style={st.dim}>입력한 내용 없음</em>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={st.msgBlock}>
                              <span style={{ ...st.who, ...st.whoClient }}>의뢰자</span>
                              <span style={st.leftText}>{reqMsg ? reqMsg : <em style={st.dim}>메시지 없음</em>}</span>
                            </div>
                          )
                        )}

                        {/* 검토 완료 → 변호사 코멘트(라운드별) */}
                        {isDone && (
                          roundComments.length > 0 ? roundComments.map((c) => (
                            <div key={c.id} style={st.msgBlock}>
                              <span style={{ ...st.who, ...st.whoLawyer }}>변호사</span>
                              {c.clause_ref && <span style={st.clauseTag}>{c.clause_ref}</span>}
                              <span style={st.leftText}>{c.body}</span>
                            </div>
                          )) : <div style={st.dim}>코멘트 없음</div>
                        )}

                        <div style={{ ...st.detailTitle, marginTop: 10 }}>관련 파일</div>
                        {files.length === 0 ? <div style={st.dim}>파일 없음</div> : files.map((f) => (
                          <div key={f.id} style={st.fileRow}>
                            <span>{contract.title}_V{f.version} · {KIND_LABEL[f.kind] ?? f.kind} · {f.format.toUpperCase()}</span>
                            <button style={st.dl} onClick={() => openFile(f.storage_path)}>열기</button>
                          </div>
                        ))}
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
  head: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 500 },
  badge: { background: '#eef2ff', color: '#4338ca', fontSize: 11, padding: '3px 9px', borderRadius: 20 },
  action: { border: 'none', background: '#1c1917', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' },
  actionLight: { border: '1px solid #d6d3d1', background: '#fff', color: '#44403c', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' },
  meta: { fontSize: 12, color: '#78716c', marginBottom: 12 },
  infoWrap: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  infoCard: { background: '#f5f5f4', border: '1px solid #eceae8', borderRadius: 10, padding: '10px 14px' },
  infoHead: { fontSize: 11, fontWeight: 600, color: '#4338ca', marginBottom: 4, textAlign: 'left' },
  infoText: { fontSize: 13, color: '#292524', lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'left' },
  miniLabel: { fontSize: 11, color: '#4338ca', marginRight: 4 },
  leftText: { textAlign: 'left', flex: 1, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  timeline: { borderLeft: '2px solid #e7e5e4', paddingLeft: 14, marginLeft: 4 },
  dayLabel: { fontSize: 12, color: '#a8a29e', margin: '0 0 6px' },
  item: { marginBottom: 6 },
  itemHead: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: '#f5f5f4', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' },
  itemTarget: { background: '#eef2ff', boxShadow: '0 0 0 2px #c7d2fe' },
  time: { fontSize: 11, color: '#78716c', minWidth: 38 },
  evName: { fontSize: 13, flex: 1 },
  chev: { fontSize: 9, color: '#a8a29e' },
  detail: { padding: '8px 12px 4px', fontSize: 12 },
  detailTitle: { color: '#78716c', marginBottom: 6 },
  dim: { color: '#a8a29e' },
  msgBlock: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', lineHeight: 1.5 },
  who: { flexShrink: 0, fontSize: 11, borderRadius: 4, padding: '1px 7px' },
  whoClient: { background: '#ecfdf5', color: '#047857' },
  whoLawyer: { background: '#eff6ff', color: '#1d4ed8' },
  clauseTag: { flexShrink: 0, background: '#eef2ff', color: '#4338ca', borderRadius: 4, padding: '1px 6px', fontSize: 11 },
  fileRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', color: '#44403c' },
  dl: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
}
