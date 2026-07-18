// 파일 업로드 공통 로직.
// 규칙(무결성 설계 반영):
//  - Storage 저장 키는 UUID 로 만든다 (한글/특수문자/충돌 방지, 덮어쓰기 없음)
//  - 화면 표시용 이름과 저장 키를 분리한다 (files.original_name 에 원래 이름 보관)
//  - HWP 원본과 PDF 변환본은 같은 file_group(UUID) 으로 묶는다
//  - 업로드 시각은 서버가 기록한다 (created_at 기본값)
//
// 주의: SHA-256 해시와 텍스트 PDF 검증은 서버(Netlify Functions)에서 할 예정.
//       이번 단계에서는 업로드·쌍 묶기까지만 구현한다.

import { supabase } from '../supabaseClient'

const BUCKET = 'contract-files'

// 확장자 추출 (없으면 'bin')
function extOf(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '')
  return m ? m[1].toLowerCase() : 'bin'
}

// 파일 하나를 Storage 에 올리고, files 테이블 레코드를 만든다.
async function uploadOne({ file, contractId, kind, format, fileGroup, version }) {
  const uid = crypto.randomUUID()
  const path = `${contractId}/${uid}.${extOf(file.name)}`

  // 1) Storage 업로드 (같은 키 재사용 안 함 → upsert:false 로 불변 보장)
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (up.error) throw up.error

  // 2) files 레코드 생성
  const rec = await supabase.from('files').insert({
    contract_id: contractId,
    kind,
    format,
    file_group: fileGroup,
    version,
    storage_path: path,
    original_name: file.name,
  })
  if (rec.error) throw rec.error
}

// HWP + PDF 한 쌍을 함께 올린다. (한쪽만 있어도 허용 — 예: 날인본은 PDF 단일)
export async function uploadFilePair({ contractId, kind, version, hwpFile, pdfFile }) {
  const fileGroup = crypto.randomUUID() // 이 쌍을 묶는 키
  if (pdfFile) {
    await uploadOne({ file: pdfFile, contractId, kind, format: 'pdf', fileGroup, version })
  }
  if (hwpFile) {
    await uploadOne({ file: hwpFile, contractId, kind, format: 'hwp', fileGroup, version })
  }
  return fileGroup
}
