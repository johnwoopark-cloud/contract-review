// 드래그 앤 드롭 파일 선택 상자. 클릭해서 고르기도 가능.
// 사용: <FileDrop label="PDF" accept="application/pdf" file={pdfFile} onFile={setPdfFile} />

import { useRef, useState } from 'react'

export default function FileDrop({ label, accept, file, onFile, hint }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  function pick(f) { if (f) onFile(f) }

  return (
    <div>
      {label && <div style={s.label}>{label}</div>}
      <div
        style={{ ...s.box, ...(over ? s.over : {}), ...(file ? s.has : {}) }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]) }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => pick(e.target.files[0])}
        />
        {file ? (
          <div style={s.fileRow}>
            <span style={s.fileIcon}>📄</span>
            <span style={s.fileName}>{file.name}</span>
            <button
              type="button"
              style={s.remove}
              onClick={(e) => { e.stopPropagation(); onFile(null); if (inputRef.current) inputRef.current.value = '' }}
            >
              ×
            </button>
          </div>
        ) : (
          <div style={s.empty}>
            <span style={s.plus}>＋</span>
            <span>파일을 끌어다 놓거나 클릭해서 선택</span>
            {hint && <span style={s.hint}>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  label: { fontSize: 12, color: '#57534e', margin: '0 0 6px' },
  box: { border: '1.5px dashed #d6d3d1', borderRadius: 10, padding: '16px', cursor: 'pointer', background: '#fafaf9', transition: 'all .15s' },
  over: { borderColor: '#6366f1', background: '#eef2ff' },
  has: { borderStyle: 'solid', borderColor: '#c7d2fe', background: '#fff' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#a8a29e', fontSize: 13, textAlign: 'center' },
  plus: { fontSize: 22, color: '#c7c3bf', lineHeight: 1 },
  hint: { fontSize: 11, color: '#c7c3bf' },
  fileRow: { display: 'flex', alignItems: 'center', gap: 8 },
  fileIcon: { fontSize: 16 },
  fileName: { flex: 1, fontSize: 13, color: '#292524', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  remove: { border: 'none', background: '#f5f5f4', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#78716c', fontSize: 14 },
}
