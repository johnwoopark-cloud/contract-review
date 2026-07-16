// 1단계용 최소 화면.
// 목적: 앱이 배포되고 Supabase 에 연결되는지만 확인한다.
// 다음 단계부터 여기에 로그인·목록·상세 화면을 붙인다.

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  // status = 연결 확인 결과를 담는 상태(state).
  // 값이 바뀌면 React 가 화면을 자동으로 다시 그린다.
  const [status, setStatus] = useState('확인 중…')

  useEffect(() => {
    // 앱이 처음 열릴 때 한 번 실행된다.
    // Supabase 에 아주 가벼운 요청을 보내 연결 여부만 확인한다.
    async function checkConnection() {
      const { error } = await supabase.auth.getSession()
      if (error) {
        setStatus('연결 실패: ' + error.message)
      } else {
        setStatus('Supabase 연결 성공')
      }
    }
    checkConnection()
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>계약 사전검토 — 셋업 확인</h1>
      <p style={{ color: '#555' }}>{status}</p>
      <p style={{ color: '#999', fontSize: 13 }}>
        이 화면이 보이고 “연결 성공”이 뜨면 1단계 환경 구축이 끝난 것입니다.
      </p>
    </div>
  )
}
