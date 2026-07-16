// Supabase 클라이언트를 한 번 만들어서 앱 전체에서 재사용한다.
// 다른 파일에서 import { supabase } from './supabaseClient' 로 가져다 쓴다.
import { createClient } from '@supabase/supabase-js'

// Vite 는 VITE_ 로 시작하는 환경 변수만 프론트엔드에 노출한다.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // 값이 비어 있으면 배포/로컬 환경 변수 설정을 빠뜨린 것.
  console.error('환경 변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 없습니다. .env 를 확인하세요.')
}

export const supabase = createClient(url, anonKey)
