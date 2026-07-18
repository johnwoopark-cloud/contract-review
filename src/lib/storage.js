// 비공개 버킷의 파일을 잠깐 열어볼 수 있는 임시 URL(서명 URL)을 만든다.
// 계약서는 비공개라 직접 주소로는 못 열고, 이렇게 짧게 유효한 링크를 발급받아야 한다.

import { supabase } from '../supabaseClient'

const BUCKET = 'contract-files'

// storage_path 를 받아 60분짜리 다운로드 URL 을 만든다.
export async function getFileUrl(storagePath) {
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60) // 60분
  if (error) throw error
  return data.signedUrl
}
