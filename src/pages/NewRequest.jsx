// 신규 검토 요청 폼.
//  - 요청자 정보(부서·팀·성명·메일)는 로그인 계정에서 자동으로 채운다(수정 불가 표시).
//  - 상대방 명칭 / 계약명 / 계약 배경 / 특별 검토 요청 사항 입력.
//  - 계약서 파일(HWP 원본 + PDF 변환본) 첨부. (PDF 는 필수, HWP 는 권장)
//  - 저장 시: 계약 생성 → 파일 업로드(V1) → 상태를 변호사 검토로 전환
//            → current_round=1 → 라운드 기록 → 변호사에게 노티 적재.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { uploadFilePair } from '../lib/files'

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
      // 1) 담당 변호사 찾기 (시험판: role=lawyer 인 첫 사용자)
      const { data: lawyer } = await supabase
        .from('profiles').select('id').eq('role', 'lawyer').limit(1).single()

      // 2) 계약 생성 (상태는 바로 변호사 검토, 1차)
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
        .select()
        .single()
      if (cErr) throw cErr

      // 3) 파일 업로드 (V1 = 최초 요청본)
      await uploadFilePair({
        contractId: contract.id,
        kind: 'request',
        version: 1,
        pdfFile,
        hwpFile,
      })

      // 4) 라운드 기록 (1차 검토 요청)
      await supabase.from('review_rounds').insert({
        contract_id: contract.id,
        round_no: 1,
        phase: 'review',
        requested_by: session.user.id,
        reviewed_by: lawyer?.id ?? null,
      })

      // 5) 히스토리 + 변호사 노티
      await supabase.from('history').insert({
        contract_id: contract.id,
        event: 'review_requested',
        actor_id: session.user.id,
        detail: { round: 1 },
      })
      if (lawyer?.id) {
        const dept = profile?.department ?? ''
        const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: contract.id,
          recipient_id: lawyer.id,
          type: 'review_request',
          round: 1,
          title: `[${dept}·${who}] ${title.trim()} 1차 검토 요청이 있습니다.`,
        })
      }

      // 완료 → 목록으로
      navigate('/contracts')
    } catch (err) {
      setError('저장 실패: ' + (err.message ?? String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>신규 검토 요청</h2>

      {/* 요청자 정보: 자동 채움, 읽기 전용 */}
      <div style={styles.reqBox}>
        <div style={styles.reqTitle}>요청자</div>
        <div style={styles.reqBody}>
          {(profile?.department ?? '-')} · {(profile?.team ?? '-')} · {(profile?.name ?? '-')} · {session?.user?.email}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="상대방 명칭">
          <input style={styles.input} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="(주)ABC" />
        </Field>
        <Field label="계약명 *">
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="용역계약서" />
        </Field>
        <Field label="계약 배경">
          <textarea style={styles.textarea} value={background} onChange={(e) => setBackground(e.target.value)} rows={3} placeholder="이 계약을 체결하려는 배경을 적어주세요." />
        </Field>
        <Field label="특별 검토 요청 사항">
          <textarea style={styles.textarea} value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} rows={3} placeholder="특별히 검토받고 싶은 조항이나 우려사항." />
        </Field>

        <Field label="계약서 PDF (필수)">
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0] ?? null)} />
        </Field>
        <Field label="계약서 HWP 원본 (권장)">
          <input type="file" accept=".hwp,.hwpx" onChange={(e) => setHwpFile(e.target.files[0] ?? null)} />
        </Field>

        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={busy}>
          {busy ? '저장 중…' : '검토 요청 보내기'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

const styles = {
  wrap: { padding: '16px 20px', maxWidth: 560, fontFamily: 'sans-serif' },
  h2: { fontSize: 15, fontWeight: 500, margin: '0 0 12px' },
  reqBox: { background: '#f5f5f4', borderRadius: 8, padding: '10px 12px', marginBottom: 18 },
  reqTitle: { fontSize: 11, color: '#78716c', marginBottom: 2 },
  reqBody: { fontSize: 13 },
  label: { display: 'block', fontSize: 12, color: '#57534e', margin: '0 0 4px' },
  input: { width: '100%', boxSizing: 'border-box', height: 38, padding: '0 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d6d3d1', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },
  button: { height: 40, padding: '0 20px', marginTop: 8, border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 12, margin: '8px 0' },
}
