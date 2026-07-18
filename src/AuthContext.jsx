// 로그인 상태(세션)와 내 프로필(역할 포함)을 앱 전체에서 공유한다.
// 어느 화면에서든 useAuth() 로 "지금 누가 로그인했는지 / 역할이 뭔지"를 알 수 있다.

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)   // 로그인 세션(없으면 null)
  const [profile, setProfile] = useState(null)   // 내 profiles 레코드(역할·부서 등)
  const [loading, setLoading] = useState(true)   // 초기 확인 중 여부

  useEffect(() => {
    // 1) 앱이 열릴 때 현재 세션을 한 번 확인
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 2) 로그인/로그아웃이 일어날 때마다 세션을 갱신
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // 세션이 바뀌면 그 사용자의 프로필(역할)을 불러온다.
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const value = { session, profile, loading }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 다른 화면에서 const { session, profile } = useAuth() 처럼 사용
export function useAuth() {
  return useContext(AuthContext)
}
