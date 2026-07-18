// 날인본 업로드 폼 (프로세스 마지막).
//  - 의뢰자가 최종 날인된 계약서를 업로드한다.
//  - 날인본은 HWP 편집본이 없을 수 있으므로 PDF 단일 업로드를 허용한다.
//  - 처리: 날인본 업로드(kind=sealed) → 상태 completed → 히스토리 + 변호사 노티.
//
// 접근: 의뢰자(owner)이고 상태가 sealing 일 때.

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { uploadFilePair } from '../lib/files'

export default function SealUpload() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, profile } = useAuth()

  const [contract, setContract] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
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
    if (contract.status !== 'sealing') return setError('지금은 날인 단계가 아닙니다.')
    if (!pdfFile) return setError('날인본 PDF를 첨부하세요.')

    setBusy(true)
    try {
      const nextVersion = await nextFileVersion(id)
      // 날인본: PDF 단일 (HWP 없음 허용)
      await uploadFilePair({ contractId: id, kind: 'sealed', version: nextVersion, pdfFile, hwpFile: null })

      await supabase.from('contracts').update({ status: 'completed' }).eq('id', id)
      await supabase.from('history').insert({
        contract_id: id, event: 'sealed', actor_id: session.user.id, detail: {},
      })
      if (contract.lawyer_id) {
        const dept = profile?.department ?? ''; const who = profile?.name ?? ''
        await supabase.from('notifications').insert({
          contract_id: id, recipient_id: contract.lawyer_id, type: 'sealed',
          title: `[${dept}·${who}] ${contract.title} 날인본이 업로드되었습니다.`,
        })
      }
      navigate(`/contracts/${id}`)
    } catch (err) {
      setError('처리 실패: ' + (err.message ?? String(err)))
    } finally { setBusy(false) }
  }

  if (loading) return <p style={s.msg}>불러오는 중…</p>
  if (error && !contract) return <p style={s.msg}>오류: {error}</p>
  if (!contract) return <p style={s.msg}>계약을 찾을 수 없습니다.</p>

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <button style={s.back} onClick={() => navigate(`/contracts/${id}`)}>← 상세로</button>
        <span style={s.title}>{contract.title} · 날인본 업로드</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>최종 날인본 PDF (필수)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0] ?? null)} />
          <p style={s.hint}>날인·서명이 완료된 최종 계약서를 올리세요. 업로드하면 계약이 ‘최종 완료’ 처리됩니다.</p>
        </div>
        {error && <p style={s.error}>{error}</p>}
        <button style={s.button} type="submit" disabled={busy}>
          {busy ? '처리 중…' : '날인본 업로드 · 최종 완료'}
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
  hint: { fontSize: 11, color: '#a8a29e', margin: '6px 0 0' },
  button: { height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#1c1917', color: '#fff', fontSize: 14, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 12, margin: '8px 0' },
}
