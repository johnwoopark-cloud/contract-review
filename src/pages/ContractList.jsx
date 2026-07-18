// 계약 목록 화면.
// contracts 테이블을 불러와 부서·팀·의뢰자·계약명·상태 5열로 보여준다.
// "누가 무엇을 보느냐"(의뢰자=본인 건 / 변호사·관리자=전체)는
// DB 의 RLS 정책이 자동으로 걸러주므로, 여기서는 그냥 전부 요청하면 된다.

import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// 상태 코드 → 한글 라벨
const STATUS_LABEL = {
  draft: '요청 준비',
  lawyer_reviewing: '변호사 검토',
  client_reviewing: '의뢰자 검토',
  final_agreed: '최종 합의',
  internal_approval: '내부 기안',
  sealing: '기안 완료·날인',
  completed: '최종 완료',
}

export default function ContractList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      // 계약 + 의뢰자(owner) 프로필의 부서·팀·성명을 함께 가져온다.
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, status, current_round, owner:owner_id ( name, department, team )')
        .order('updated_at', { ascending: false })

      if (error) setError(error.message)
      else setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p style={styles.msg}>불러오는 중…</p>
  if (error) return <p style={styles.msg}>오류: {error}</p>

  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>계약 목록</h2>
      {rows.length === 0 ? (
        <p style={styles.msg}>아직 등록된 계약이 없습니다. ‘신규 검토 요청’으로 시작하세요.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.headRow}>
              <th style={styles.th}>부서</th>
              <th style={styles.th}>팀</th>
              <th style={styles.th}>의뢰자</th>
              <th style={styles.th}>계약명</th>
              <th style={styles.th}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={styles.row}>
                <td style={styles.td}>{r.owner?.department ?? '-'}</td>
                <td style={styles.td}>{r.owner?.team ?? '-'}</td>
                <td style={styles.td}>{r.owner?.name ?? '-'}</td>
                <td style={styles.td}>{r.title}</td>
                <td style={styles.td}>
                  {STATUS_LABEL[r.status] ?? r.status}
                  {r.current_round > 0 ? ` (${r.current_round}차)` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const styles = {
  wrap: { padding: '16px 20px', fontFamily: 'sans-serif' },
  h2: { fontSize: 15, fontWeight: 500, margin: '0 0 12px' },
  msg: { padding: '16px 20px', color: '#78716c', fontSize: 13, fontFamily: 'sans-serif' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  headRow: { textAlign: 'left', color: '#78716c' },
  th: { padding: '8px 6px', fontWeight: 400, borderBottom: '1px solid #e7e5e4' },
  row: { borderBottom: '1px solid #f0efed' },
  td: { padding: '10px 6px' },
}
