// 변호사 검토 화면 (고도화: 왼쪽 본문 PDF + 오른쪽 조항 코멘트).
//  - 왼쪽: 최신 계약서 PDF 를 iframe 으로 크게 표시 (서명 URL)
//  - 오른쪽: 조항(제N조) + 코멘트 여러 개 작성, 수정본 업로드, 검토 완료
//  - 앵커링은 문자열(조항) 기준(설계 결정). iframe 이라 문자 하이라이트는 없음.

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
  const [pdfUrl, setPdfUrl] = useState('')      // 왼쪽에 띄울 PDF
  const [pdfList, setPdfList] = useState([])    // 볼 수 있는 PDF 파일들(버전 선택)
  const [comments, setComments] = useState([{ clause: '', body: '' }])
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

      // PDF 파일들(최신순) — 왼쪽 뷰어용
      const f = await supabase.from('files').select('*')
        .eq('contract_id', id).eq('format', 'pdf').order('version', { ascending: false })
      const list = f.data ?? []
      setPdfList(list)
      if (list.length > 0) {
        try { setPdfUrl(await getFileUrl(list[0].storage_path)) } catch { /* noop */ }
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function showPdf(file) {
    try { setPdfUrl(await getFileUrl(file.storage_path)) }
    catch (e) { alert('파일 열기 오류: ' + e.message) }
  }

  function updateComment(i, key, val) { setComments((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: val } : c))) }
  function addComment() { setComments((cs) => [...cs, { clause: '', body: '' }]) }
  function removeComment(i) { setComments((cs) => cs.filter((_, idx) => idx !== i)) }

  async function handleComplete() {
    setError('')
    if (contract.status !== 'lawyer_reviewing') return setError('지금은 변호사 검토 단계가 아닙니다.')
    if (!pdfFile) return setError('수정본 PDF를 첨부하세요.')

    setBusy(true)
    try {
      const round = contract.current_round
      const nextVersion = await nextFileVersion(id)
      const { data: rd } = await supabase.from('review_rounds')
        .select('id').eq('contract_id', id).eq('round_no', round).single()
      const roundId = rd?.id ?? null

      await uploadFilePair({ contractId: id, kind: 'revision', version: nextVersion, pdfFile, hwpFile })

      const valid = comments.filter((c) => c.body.trim())
      if (valid.length > 0) {
        await supabase.from('comments').insert(valid.map((c) => ({
          contract_id: id, round_id: roundId, author_id: session.user.id,
          clause_ref: c.clause.trim() || null, body: c.body.trim(),
        })))
      }

      await supabase.from('review_rounds')
        .update({ result: 'approved', review_msg: '검토 완료', reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
        .eq('contract_id', id).eq('round_no', round)
      await supabase.from('contracts').update({ status: 'client_reviewing' }).eq('id', id)
      await supabase.from('history').insert({ contract_id: id, event: 'review_done', actor_id: session.user.id, detail: { round } })
      await supabase.from('notifications').insert({
        contract_id: id, recipient_id: contract.owner_id, type: 'review_done',
        round,
        title: `${contract.title} ${round}차 검토 의견이 등록되었습니다.`,
      })

      navigate(`/contracts/${id}`)
    } catch (err) {
      setError('처리 실패: ' + (err.message ?? String(err)))
    } finally { setBusy(false) }
  }

  if (loading) return <p style={s.msg}>불러오는 중…</p>
  if (error && !contract) return <p style={s.msg}>오류: {error}</p>
  if (!contract) return <p style={s.msg}>계약을 찾을 수 없습니다.</p>

  const isLawyer = profile?.role === 'lawyer'

  return (
    <div style={s.page}>
      {/* 상단 바 */}
      <div style={s.head}>
        <button style={s.back} onClick={() => navigate(`/contracts/${id}`)}>← 상세로</button>
        <span style={s.title}>{contract.title} · 검토</span>
        {/* PDF 버전 선택 */}
        {pdfList.length > 0 && (
          <select style={s.select} onChange={(e) => showPdf(pdfList[e.target.value])}>
            {pdfList.map((f, i) => (
              <option key={f.id} value={i}>V{f.version} · {f.kind}</option>
            ))}
          </select>
        )}
      </div>

      {!isLawyer && <p style={s.warn}>변호사 계정에서만 검토를 완료할 수 있습니다.</p>}

      {/* 2단: 왼쪽 본문 / 오른쪽 코멘트 */}
      <div style={s.split}>
        <div style={s.left}>
          {pdfUrl ? (
            <iframe title="contract-pdf" src={pdfUrl} style={s.iframe} />
          ) : (
            <div style={s.noPdf}>표시할 PDF가 없습니다.</div>
          )}
        </div>

        <div style={s.right}>
          <div style={s.secTitle}>검토 코멘트</div>
          <div style={s.comments}>
            {comments.map((c, i) => (
              <div key={i} style={s.cRow}>
                <input style={s.clause} placeholder="제3조" value={c.clause}
                  onChange={(e) => updateComment(i, 'clause', e.target.value)} />
                <textarea style={s.cbody} placeholder="코멘트 내용" rows={2} value={c.body}
                  onChange={(e) => updateComment(i, 'body', e.target.value)} />
                {comments.length > 1 && <button style={s.rm} onClick={() => removeComment(i)}>×</button>}
              </div>
            ))}
            <button style={s.add} onClick={addComment}>+ 코멘트 추가</button>
          </div>

          <div style={s.secTitle}>수정본 업로드</div>
          <div style={s.uprow}><span style={s.uplabel}>PDF *</span>
            <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0] ?? null)} /></div>
          <div style={s.uprow}><span style={s.uplabel}>HWP</span>
            <input type="file" accept=".hwp,.hwpx" onChange={(e) => setHwpFile(e.target.files[0] ?? null)} /></div>

          {error && <p style={s.error}>{error}</p>}
          <button style={{ ...s.complete, opacity: isLawyer ? 1 : 0.5 }}
            onClick={handleComplete} disabled={busy || !isLawyer}>
            {busy ? '처리 중…' : '검토 완료 (의뢰자에게 전달)'}
          </button>
        </div>
      </div>
    </div>
  )
}

async function nextFileVersion(contractId) {
  const { data } = await supabase.from('files').select('version')
    .eq('contract_id', contractId).order('version', { ascending: false }).limit(1)
  return (data && data.length ? data[0].version : 0) + 1
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 45px)', fontFamily: 'sans-serif' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #e7e5e4' },
  back: { border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' },
  title: { fontSize: 14, fontWeight: 500 },
  select: { marginLeft: 'auto', height: 30, border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 12, padding: '0 6px' },
  warn: { background: '#fef3c7', color: '#92400e', fontSize: 12, padding: '8px 16px', margin: 0 },
  split: { display: 'flex', flex: 1, minHeight: 0 },
  left: { flex: '1 1 62%', borderRight: '1px solid #e7e5e4', minWidth: 0, background: '#f5f5f4' },
  iframe: { width: '100%', height: '100%', border: 'none' },
  noPdf: { padding: 20, color: '#a8a29e', fontSize: 13 },
  right: { flex: '1 1 38%', minWidth: 300, overflowY: 'auto', padding: '14px 16px' },
  secTitle: { fontSize: 13, fontWeight: 500, margin: '4px 0 8px' },
  comments: { marginBottom: 18 },
  cRow: { display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-start' },
  clause: { width: 78, flexShrink: 0, height: 34, padding: '0 8px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 13 },
  cbody: { flex: 1, padding: '6px 8px', border: '1px solid #d6d3d1', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' },
  rm: { width: 28, height: 34, border: '1px solid #d6d3d1', background: '#fff', borderRadius: 6, cursor: 'pointer', color: '#78716c' },
  add: { border: '1px dashed #d6d3d1', background: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#57534e' },
  uprow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 13 },
  uplabel: { width: 50, color: '#57534e' },
  error: { color: '#b91c1c', fontSize: 12, margin: '8px 0' },
  complete: { width: '100%', height: 40, marginTop: 10, border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
}
