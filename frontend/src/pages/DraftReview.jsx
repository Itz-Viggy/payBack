/**
 * DraftReview.jsx
 *
 * Resume-flow wrapper for the dispute-letter drafting step.
 * Reached via: /draft/:analysisId  (linked from the Status dashboard)
 *
 * Responsibilities:
 *  1. Read :analysisId from the URL with useParams()
 *  2. Fetch the persisted analysis record from GET /api/history/analysis/:id
 *  3. Reshape the flat DB record into the `report` + `items` shapes that
 *     Dispute.jsx already understands
 *  4. Navigate to /dispute/:analysisId with the hydrated state — Dispute.jsx
 *     reads these from location.state and pre-fills its UI
 *
 * This file intentionally does NOT duplicate the Dispute UI.
 * It is purely a loading/routing shim.
 */

import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../api/client'

export default function DraftReview() {
  const { analysisId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (!analysisId) {
      navigate('/', { replace: true })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const record = await api.getAnalysis(analysisId)
        if (cancelled) return

        // ── Reshape flat analysis record → Dispute.jsx state shapes ──────
        //
        // `report` mirrors the object Dispute.jsx reads from location.state.report
        const report = {
          hospitalName: record.hospital_name || 'Unknown Hospital',
          accountNumber: record.id?.slice(-8).toUpperCase() ?? '—',
          dateOfService: record.created_at ? record.created_at.slice(0, 10) : '',
        }

        // `items` mirrors the selectedItems array Dispute.jsx renders in the letter
        // We reconstruct line items from the parallel arrays stored in MongoDB.
        const items = (record.extracted_codes || []).map((code, i) => ({
          id: `li-${i + 1}`,
          cptCode: code,
          description: '',                                          // not stored flat — shown as empty
          billed: (record.billed_charges || [])[i] ?? 0,
          benchmark: (() => {
            const benches = (record.standard_charges || [])[i] ?? []
            const charges = benches
              .map((b) => parseFloat(b?.standard_charge ?? 0))
              .filter(Boolean)
            return charges.length ? Math.min(...charges) : 0
          })(),
          citation: '',
          reason: '',
        }))

        // Pre-select all items (user can deselect in Dispute.jsx)
        const selectedItemIds = items.map((item) => item.id)

        // ── Navigate to Dispute.jsx with hydrated state ───────────────────
        navigate(`/dispute/${analysisId}`, {
          replace: true,
          state: {
            report,
            selectedItems: items,
            selectedItemIds,
            analysisId,
          },
        })
      } catch (err) {
        if (!cancelled) {
          // If fetch fails, fall back to a fresh dispute page rather than a blank screen
          navigate('/dispute', {
            replace: true,
            state: { resumeError: err.message || 'Failed to load draft data.' },
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [analysisId, navigate])

  // While fetching, show a minimal loading screen
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-amber" />
      <p className="font-mono text-sm uppercase tracking-widest text-text-muted">
        Loading your draft…
      </p>
    </section>
  )
}
