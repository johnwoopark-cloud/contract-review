// 신규 검토 요청 폼 (재설계: 왼쪽 정렬 + 드래그앤드롭 업로드).
//  - 요청자 정보 자동 채움
//  - 상대방·계약명·배경·특별 요청사항
//  - 계약서 PDF(필수) + HWP(권장) 드래그앤드롭
//  - 저장 시 계약 생성 → 파일 업로드(V1) → 변호사 검토로 → 라운드/히스토리/노티

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { uploadFilePair } from '../lib/files'
import FileDrop from '../components/FileDrop'

export default function NewRequest() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()

  const [counterparty, setCounterparty] = useState('')
  const [title, setTitle] = useState('')
  const [background, setBackground] = useState('')
  const [specialRequest, setSpecialRequest] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [hwpFile, setHwpFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('계약명을 입력하세요.')
    if (!pdfFile) return setError('계약서 PDF 파일을 첨부하세요.')

    setBusy(true)
    try {
      const { data: lawyer } = await supabase
        .from('profiles').select('id').eq('role', 'lawyer').limit(1).single()

      const { data: contract, error: cErr } = await supabase
        .from('contracts')
        .insert({
          title: title.trim(),
          counterparty: counterparty.trim() || null,
          status: 'lawyer_reviewing',
          owner_id: session.user.id,
          lawyer_id: lawyer?.id ?? null,
          context_info: { background, special_request: specialRequest },
          current_round: 1,
        })
        .select().single()
      if (cErr) throw cErr

      await uploadFilePair({ contractId: contract.id, kind: 'request', version: 1, pdfFile, hwpFile })

      await supabase.from('review_rounds').insert({
        contract_id: contract.id, round_no: 1, phase: 'review',
        requested_by: session.user.id, reviewed_by: lawyer?.id ?? null,
      })
      await supabase.from('history').insert({
        contract_id: contract.id, event: 'review_requested', actor_id: session.user.id, detail: { round: 1 },
      })
      if (lawyer?.id) {
        const dept = profile?.department ?? ''; const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: contract.id, recipient_id: lawyer.id, type: 'review_request', round: 1,
          title: `[${dept}·${who}] ${title.trim()} 1차 검토 요청이 있습니다.`,
        })
      }
      navigate('/contracts')
    } catch (err) {
      setError('저장 실패: ' + (err.message ?? String(err)))
    } finally { setBusy(false) }
  }

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>신규 검토 요청</h2>

      <div style={s.reqBox}>
        <div style={s.reqTitle}>요청자</div>
        <div style={s.reqBody}>
          {(profile?.department ?? '-')} · {(profile?.team ?? '-')} · {(profile?.name ?? '-')} · {session?.user?.email}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="상대방 명칭">
          <input style={s.input} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="(주)ABC" />
        </Field>
        <Field label="계약명 *">
          <input style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="용역계약서" />
        </Field>
        <Field label="계약 배경">
          <textarea style={s.textarea} value={background} onChange={(e) => setBackground(e.target.value)} rows={3} placeholder="이 계약을 체결하려는 배경을 적어주세요." />
        </Field>
        <Field label="특별 검토 요청 사항">
          <textarea style={s.textarea} value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} rows={3} placeholder="특별히 검토받고 싶은 조항이나 우려사항." />
        </Field>

        <div style={s.uploads}>
          <div style={s.uploadCol}>
            <FileDrop label="계약서 PDF (필수)" accept="application/pdf" file={pdfFile} onFile={setPdfFile} hint="한글에서 ‘PDF로 저장’한 파일" />
          </div>
          <div style={s.uploadCol}>
            <FileDrop label="계약서 HWP 원본 (권장)" accept=".hwp,.hwpx" file={hwpFile} onFile={setHwpFile} hint="편집본 보관용" />
          </div>
        </div>

        {error && <p style={s.error}>{error}</p>}
        <button style={s.button} type="submit" disabled={busy}>
          {busy ? '저장 중…' : '검토 요청 보내기'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  wrap: { padding: '20px 24px', maxWidth: 620, textAlign: 'left', fontFamily: 'sans-serif' },
  h2: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', textAlign: 'left' },
  reqBox: { background: '#f5f5f4', borderRadius: 10, padding: '12px 14px', marginBottom: 20 },
  reqTitle: { fontSize: 11, color: '#78716c', marginBottom: 3 },
  reqBody: { fontSize: 13 },
  label: { display: 'block', fontSize: 12, color: '#57534e', margin: '0 0 6px', textAlign: 'left' },
  input: { width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 },
  uploads: { display: 'flex', gap: 12, marginTop: 4, marginBottom: 4 },
  uploadCol: { flex: 1, minWidth: 0 },
  button: { height: 42, padding: '0 22px', marginTop: 18, border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 12, margin: '12px 0 0' },
}
