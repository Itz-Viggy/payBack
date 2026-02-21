import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

function getRejectionMessage(rejection) {
  const [error] = rejection.errors
  if (!error) return 'Unable to process this file.'

  if (error.code === 'file-invalid-type') {
    return 'Unsupported file type. Use PDF, JPG, or PNG only.'
  }

  if (error.code === 'file-too-large') {
    return 'File is too large. Maximum size is 20MB.'
  }

  return error.message
}

export default function BillUploader({ onFileAccepted, disabled = false }) {
  const [error, setError] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')

  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      if (fileRejections.length > 0) {
        setError(getRejectionMessage(fileRejections[0]))
        return
      }

      const file = acceptedFiles[0]
      if (!file) return

      setError('')
      setSelectedFileName(file.name)
      onFileAccepted(file)
    },
    [onFileAccepted]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled,
    maxSize: MAX_SIZE_BYTES,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
  })

  return (
    <div className="w-full max-w-[480px]">
      <div
        {...getRootProps()}
        className={`rounded-sharp border-2 border-dashed px-8 py-12 text-center transition-all duration-200 ${
          isDragActive
            ? 'border-amber bg-amber-dim'
            : 'border-border-default bg-[rgba(19,18,16,0.4)] hover:border-amber-border'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 h-8 w-8 text-text-muted" strokeWidth={1.5} />
        <p className="font-display text-[17px] font-bold text-text-primary">Drop your bill here</p>
        <p className="mt-2 font-mono text-xs font-light text-text-muted">
          PDF . JPG . PNG . Max 20MB . Itemized bills only
        </p>

        {selectedFileName ? (
          <p className="mt-4 font-mono text-xs text-amber">Selected: {selectedFileName}</p>
        ) : null}

        {error ? (
          <p className="mt-4 font-mono text-xs text-flag-high">{error}</p>
        ) : null}

        <button type="button" onClick={open} disabled={disabled} className="btn-primary mt-6">
          SELECT FILE
        </button>
      </div>
    </div>
  )
}
