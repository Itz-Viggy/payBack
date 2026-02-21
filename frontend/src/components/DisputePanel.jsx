const stateOptions = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function SectionTitle({ children }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber">{children}</p>
      <span className="mt-2 block h-px w-full bg-amber-border" />
    </div>
  )
}

export default function DisputePanel({
  patientDetails,
  onPatientChange,
  items,
  selectedItemIds,
  onToggleItem,
  onGenerate,
  isGenerating,
}) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>PATIENT DETAILS</SectionTitle>

        <label className="input-label">FULL NAME</label>
        <input
          value={patientDetails.fullName}
          onChange={(event) => onPatientChange({ fullName: event.target.value })}
          className="input-control"
          placeholder="PATIENT NAME"
        />

        <label className="input-label mt-4">MAILING ADDRESS</label>
        <textarea
          rows={3}
          value={patientDetails.mailingAddress}
          onChange={(event) => onPatientChange({ mailingAddress: event.target.value })}
          className="input-control resize-none"
          placeholder="123 MAIN ST\nBOSTON, MA 02114"
        />

        <label className="input-label mt-4">STATE</label>
        <select
          value={patientDetails.state}
          onChange={(event) => onPatientChange({ state: event.target.value })}
          className="input-control"
        >
          <option value="">Select</option>
          {stateOptions.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </section>

      <section>
        <SectionTitle>DISPUTED ITEMS</SectionTitle>
        <div className="rounded-sharp border border-border-subtle">
          {items.map((item) => {
            const checked = selectedItemIds.includes(item.id)
            return (
              <label
                key={item.id}
                className="flex items-center gap-3 border-b border-border-subtle px-3 py-3 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleItem(item.id)}
                  className="h-4 w-4 accent-amber"
                />
                <p className="w-16 font-mono text-xs font-semibold text-amber">{item.cptCode}</p>
                <p className="flex-1 font-display text-sm text-text-primary">{item.description}</p>
                <p className="font-mono text-xs text-text-code">{formatCurrency(item.billed)}</p>
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle>DELIVERY</SectionTitle>
        <label className="input-label">HOSPITAL BILLING EMAIL</label>
        <input
          value={patientDetails.billingEmail}
          onChange={(event) => onPatientChange({ billingEmail: event.target.value })}
          className="input-control"
          placeholder="billing@hospital.org"
        />
        <p className="mt-2 font-mono text-[11px] text-text-muted">
          Find on your bill or call the billing department.
        </p>
      </section>

      <button type="button" className="btn-primary w-full" onClick={onGenerate} disabled={isGenerating}>
        {isGenerating ? 'GENERATING...' : 'GENERATE LETTER ?'}
      </button>
    </div>
  )
}
