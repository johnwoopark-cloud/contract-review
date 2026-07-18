// 변호사 검토 화면 (단순 버전).
//  - 계약서 파일은 '열기'로 새 탭에서 본다(넓은 본문+코멘트 앵커링은 이후 고도화).
//  - 조항(clause_ref) + 코멘트 내용을 여러 개 작성.
//  - 수정본 파일(HWP+PDF) 업로드.
//  - '검토 완료' → 상태를 client_reviewing 으로, 코멘트 저장, 라운드 결과 기록,
//                  히스토리 + 의뢰자 노티.
//
// 접근: 변호사(role=lawyer)만 의미가 있다. 상태가 lawyer_reviewing 일 때만 완료 가능.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { getFileUrl } from '../lib/storage'
import { uploadFilePair } from '../lib/files'

export default function LawyerReview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, profile } = useAuth()

  const [contract, setContract] = useState(null)
  const [latestFiles, setLatestFiles] = useState([])
  const [comments, setComments] = useState([{ clause: '', body: '' }]) // 입력용 코멘트들
  const [pdfFile, setPdfFile] = useState(null)
  const [hwpFile, setHwpFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const c = await supabase.from('contracts').select('*').eq('id', id).single()
      if (c.error) { setError(c.error.message); setLoading(false); return }
      setContract(c.data)
      // 가장 최근 파일 몇 개(열어보기용)
      const f = await supabase.from('files').select('*')
        .eq('contract_id', id).order('created_at', { ascending: false }).limit(4)
      setLatestFiles(f.data ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  function updateComment(i, key, val) {
    setComments((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)))
  }
  function addComment() { setComments((cs) => [...cs, { clause: '', body: '' }]) }
  function removeComment(i) { setComments((cs) => cs.filter((_, idx) => idx !== i)) }

  async function openFile(path) {
    try { window.open(await getFileUrl(path), '_blank') }
    catch (e) { alert('파일 열기 오류: ' + e.message) }
  }

  async function handleComplete() {
    setError('')
    if (!contract) return
    if (contract.status !== 'lawyer_reviewing') {
      return setError('지금은 변호사 검토 단계가 아닙니다.')
    }
    if (!pdfFile) return setError('수정본 PDF를 첨부하세요.')

    setBusy(true)
    try {
      const round = contract.current_round // 현재 라운드(요청 시 부여됨)
      const nextVersion = await nextFileVersion(id)

      // 1) 수정본 업로드 (revision)
      await uploadFilePair({ contractId: id, kind: 'revision', version: nextVersion, pdfFile, hwpFile })

      // 2) 코멘트 저장 (조항+내용이 있는 것만)
      const validComments = comments.filter((c) => c.body.trim())
      if (validComments.length > 0) {
        await supabase.from('comments').insert(
          validComments.map((c) => ({
            contract_id: id,
            author_id: session.user.id,
            clause_ref: c.clause.trim() || null,
            body: c.body.trim(),
          }))
        )
      }

      // 3) 라운드 결과 기록 (해당 라운드의 검토 완료)
      await supabase.from('review_rounds')
        .update({ result: 'approved', review_msg: '검토 완료', reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
        .eq('contract_id', id).eq('round_no', round)

      // 4) 상태 전환: 의뢰자 검토로
      await supabase.from('contracts').update({ status: 'client_reviewing' }).eq('id', id)

      // 5) 히스토리 + 의뢰자 노티
      await supabase.from('history').insert({
        contract_id: id, event: 'review_done', actor_id: session.user.id, detail: { round },
      })
      await supabase.from('notifications').insert({
        contract_id: id,
        recipient_id: contract.owner_id,
        type: 'review_done',
        title: `${contract.title} ${round}차 검토 의견이 등록되었습니다.`,
      })

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

  const isLawyer = profile?.role === 'lawyer'

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <button style={s.back} onClick={() => navigate(`/contracts/${id}`)}>← 상세로</button>
        <span style={s.title}>{contract.title} · 검토</span>
      </div>

      {!isLawyer && <p style={s.warn}>변호사 계정에서만 검토를 완료할 수 있습니다. (열람은 가능)</p>}

      <div style={s.section}>
        <div style={s.secTitle}>계약서 열어보기</div>
        {latestFiles.length === 0 ? <div style={s.dim}>파일 없음</div> : latestFiles.map((f) => (
          <div key={f.id} style={s.fileRow}>
            <span>{contract.title}_V{f.version} · {f.format.toUpperCase()}</span>
            <button style={s.dl} onClick={() => openFile(f.storage_path)}>열기</button>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secTitle}>검토 코멘트</div>
        {comments.map((c, i) => (
          <div key={i} style={s.commentRow}>
            <input style={s.clause} placeholder="조항 (예: 제3조)" value={c.clause}
              onChange={(e) => updateComment(i, 'clause', e.target.value)} />
            <textarea style={s.cbody} placeholder="코멘트 내용" rows={2} value={c.body}
              onChange={(e) => updateComment(i, 'body', e.target.value)} />
            {comments.length > 1 && (
              <button style={s.rm} onClick={() => removeComment(i)}>×</button>
            )}
          </div>
        ))}
        <button style={s.add} onClick={addComment}>+ 코멘트 추가</button>
      </div>

      <div style={s.section}>
        <div style={s.secTitle}>수정본 업로드</div>
        <div style={s.uprow}><span style={s.uplabel}>PDF (필수)</span>
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0] ?? null)} /></div>
        <div style={s.uprow}><span style={s.uplabel}>HWP (권장)</span>
          <input type="file" accept=".hwp,.hwpx" onChange={(e) => setHwpFile(e.target.files[0] ?? null)} /></div>
      </div>

      {error && <p style={s.error}>{error}</p>}
      <button style={{ ...s.complete, opacity: isLawyer ? 1 : 0.5 }}
        onClick={handleComplete} disabled={busy || !isLawyer}>
        {busy ? '처리 중…' : '검토 완료 (의뢰자에게 전달)'}
      </button>
    </div>
  )
}

// 이 계약의 다음 파일 버전 번호 = max(version)+1
async function nextFileVersion(contractId) {
  const { data } = await supabase.from('files').select('version')
    .eq('contract_id', contractId).order('version', { ascending: false }).limit(1)
  const max = data && data.length ? data[0].version : 0
  return max + 1
}

const s = {
  wrap: { padding: '16px 20px', maxWidth: 640, fontFamily: 'sans-serif' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 15, fontWeight: 500 },
  warn: { background: '#fef3c7', color: '#92400e', fontSize: 12, padding: '8px 10px', borderRadius: 8, marginBottom: 14 },
  section: { marginBottom: 18 },
  secTitle: { fontSize: 13, fontWeight: 500, marginBottom: 8 },
  dim: { color: '#a8a29e', fontSize: 12 },
  fileRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', fontSize: 12 },
  dl: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' },
  commentRow: { display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' },
  clause: { width: 110, flexShrink: 0, height: 34, padding: '0 8px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 13 },
  cbody: { flex: 1, padding: '6px 8px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' },
  rm: { width: 28, height: 34, border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#78716c' },
  add: { border: '1px dashed #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#57534e' },
  uprow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 13 },
  uplabel: { width: 80, color: '#57534e' },
  error: { color: '#b91c1c', fontSize: 12, margin: '8px 0' },
  complete: { height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
}
