// Lab 3.2 · Form that records one sale into Firestore (Prompt 3.2C).
// Checks with validateSaleForm and builds the document with buildSale, so it has the same shape as the import.
import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'
import { BRANCHES, MAX_QTY, PAYMENTS, buildSale, validateSaleForm } from './saleModel.js'
import { formatBaht } from '../lib/metrics'

const EMPTY = { branch: '', product_id: '', qty: '1', payment_method: PAYMENTS[0], customer_id: '' }
const UID = 'anonymous' // Lab 3.3 replaces this with the signed-in user

const inputClass =
  'mt-1 block h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-invalid:border-red-500'

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs text-muted sm:text-sm">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  )
}

function SaleForm({ products }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [checked, setChecked] = useState(false) // show errors as you type only after the first save attempt
  const [status, setStatus] = useState(null) // { type: 'saving' | 'ok' | 'error', text }

  const product = products.find((p) => p.product_id === form.product_id)
  const qtyOk = !validateSaleForm({ ...form, branch: BRANCHES[0], product_id: product?.product_id }, products).qty
  const total = product && qtyOk ? Number(form.qty) * product.price : null
  const saving = status?.type === 'saving'

  const change = (field) => (e) => {
    const next = { ...form, [field]: e.target.value }
    setForm(next)
    if (checked) setErrors(validateSaleForm(next, products))
  }

  const submit = async (e) => {
    e.preventDefault()
    const found = validateSaleForm(form, products)
    setErrors(found)
    setChecked(true)
    if (Object.keys(found).length > 0) return

    const { id, data } = buildSale(form, product, { uid: UID })
    setStatus({ type: 'saving' })
    try {
      await setDoc(doc(db, 'sales', id), { ...data, created_at: serverTimestamp() })
      setStatus({ type: 'ok', text: `บันทึกบิล ${data.order_id} แล้ว · ${formatBaht(data.revenue)}` })
      // Keep branch and payment (usually the same for the next customer); clear the rest.
      setForm((f) => ({ ...f, product_id: '', qty: '1', customer_id: '' }))
      setChecked(false)
      setErrors({})
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.code === 'permission-denied' ? 'ถูกปฏิเสธโดย Security Rules' : `บันทึกไม่สำเร็จ: ${err.message}`,
      })
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rise rounded-2xl border border-line bg-surface/85 p-4 shadow-card backdrop-blur-sm sm:p-6"
      style={{ animationDelay: '120ms' }}
    >
      <h2 className="flex items-center gap-2 font-medium text-ink">
        <span className="inline-block h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
        บันทึกยอดขาย
      </h2>
      <p className="mt-0.5 mb-4 text-xs text-muted sm:text-sm">บันทึกแล้วแดชบอร์ดทุกหน้าต่างจะขยับเอง</p>

      <div className="space-y-3">
        <Field label="สาขา" error={errors.branch}>
          <select value={form.branch} onChange={change('branch')} aria-invalid={Boolean(errors.branch)} className={inputClass}>
            <option value="">เลือกสาขา…</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>

        <Field label="เมนู" error={errors.product_id}>
          <select value={form.product_id} onChange={change('product_id')} aria-invalid={Boolean(errors.product_id)} className={inputClass}>
            <option value="">{products.length ? 'เลือกเมนู…' : 'กำลังโหลดเมนู…'}</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} · {formatBaht(p.price)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="จำนวน" error={errors.qty}>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_QTY}
              step="1"
              value={form.qty}
              onChange={change('qty')}
              aria-invalid={Boolean(errors.qty)}
              className={inputClass}
            />
          </Field>
          <Field label="วิธีชำระเงิน" error={errors.payment_method}>
            <select value={form.payment_method} onChange={change('payment_method')} aria-invalid={Boolean(errors.payment_method)} className={inputClass}>
              {PAYMENTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="รหัสสมาชิก (ไม่บังคับ)" error={errors.customer_id}>
          <input
            type="text"
            placeholder="เช่น C01234"
            autoComplete="off"
            value={form.customer_id}
            onChange={change('customer_id')}
            aria-invalid={Boolean(errors.customer_id)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">ยอดรวม</span>
        <span className="text-2xl font-light text-ink tabular-nums">{total == null ? '–' : formatBaht(total)}</span>
      </div>

      <button
        type="submit"
        disabled={saving}
        data-sound="select"
        className="mt-4 h-11 w-full rounded-xl bg-accent font-medium text-surface shadow-card transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {saving ? 'กำลังบันทึก…' : 'บันทึกยอดขาย'}
      </button>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm">
        {status?.type === 'ok' && <span className="text-emerald-500">✅ {status.text}</span>}
        {status?.type === 'error' && <span className="text-red-500">❌ {status.text}</span>}
      </p>
    </form>
  )
}

export default SaleForm
