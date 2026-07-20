// 의뢰자 재검토 요청 폼.
//  - 의뢰자가 상대방과 협의해 반영한 수정본(HWP+PDF)을 올리고, 변호사에게 다시 검토를 요청한다.
//  - 처리: 라운드 +1 → 수정본 업로드 → 상태를 lawyer_reviewing 으로
//          → 라운드 기록 → 히스토리 + 변호사 노티.
//
// 접근: 의뢰자(owner)이고 상태가 client_reviewing 일 때만 의미가 있다.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { uploadFilePair } from '../lib/files'
import FileDrop from '../components/FileDrop'

export default function ClientResubmit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, profile } = useAuth()

  const [contract, setContract] = useState(null)
  const [message, setMessage] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [hwpFile, setHwpFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const c = await supabase.from('contracts').select('*').eq('id', id).single()
      if (c.error) setError(c.error.message)
      else setContract(c.data)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (contract.status !== 'client_reviewing') return setError('지금은 의뢰자 검토 단계가 아닙니다.')
    if (!pdfFile) return setError('수정본 PDF를 첨부하세요.')

    setBusy(true)
    try {
      const nextRound = contract.current_round + 1
      const nextVersion = await nextFileVersion(id)

      // 1) 수정본 업로드
      await uploadFilePair({ contractId: id, kind: 'revision', version: nextVersion, pdfFile, hwpFile })

      // 2) 상태·라운드 갱신 (변호사 검토로, 라운드 +1)
      await supabase.from('contracts').update({
        status: 'lawyer_reviewing', current_round: nextRound,
      }).eq('id', id)

      // 3) 라운드 기록 (새 라운드 요청)
      await supabase.from('review_rounds').insert({
        contract_id: id, round_no: nextRound, phase: 'review',
        requested_by: session.user.id, reviewed_by: contract.lawyer_id, request_msg: message.trim() || null,
      })

      // 4) 히스토리 + 변호사 노티
      await supabase.from('history').insert({
        contract_id: id, event: 'review_requested', actor_id: session.user.id, detail: { round: nextRound },
      })
      if (contract.lawyer_id) {
        const dept = profile?.department ?? ''
        const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: id, recipient_id: contract.lawyer_id, type: 'review_request',
          round: nextRound,
          title: `[${dept}·${who}] ${contract.title} ${nextRound}차 검토 요청이 있습니다.`,
        })
      }

      navigate(`/contracts/${id}`)
    } catch (err) {
      setError('처리 실패: ' + (err.message ?? String(err)))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p style={s.msg}>불러오는 중…</p>
  if (error && !contract) return <p style={s.msg}>오류: {error}</p>
  if (!contract) return <p style={s.msg}>계약을 찾을 수 없습니다.</p>

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <button style={s.back} onClick={() => navigate(`/contracts/${id}`)}>← 상세로</button>
        <span style={s.title}>{contract.title} · 재검토 요청 ({contract.current_round + 1}차)</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>요청 메시지 (선택)</label>
          <textarea style={s.textarea} rows={3} value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="상대방과 협의한 내용, 이번에 반영한 수정 사항 등을 적어주세요." />
        </div>
        <div style={{ marginBottom: 14 }}>
          <FileDrop label="수정본 PDF (필수)" accept="application/pdf" file={pdfFile} onFile={setPdfFile} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <FileDrop label="수정본 HWP (권장)" accept=".hwp,.hwpx" file={hwpFile} onFile={setHwpFile} />
        </div>
        {error && <p style={s.error}>{error}</p>}
        <button style={s.button} type="submit" disabled={busy}>
          {busy ? '처리 중…' : '재검토 요청 보내기'}
        </button>
      </form>
    </div>
  )
}

async function nextFileVersion(contractId) {
  const { data } = await supabase.from('files').select('version')
    .eq('contract_id', contractId).order('version', { ascending: false }).limit(1)
  return (data && data.length ? data[0].version : 0) + 1
}

const s = {
  wrap: { padding: '16px 20px', maxWidth: 560, fontFamily: 'sans-serif' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 500 },
  label: { display: 'block', fontSize: 12, color: '#57534e', margin: '0 0 4px' },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },
  button: { height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 12, margin: '8px 0' },
}
