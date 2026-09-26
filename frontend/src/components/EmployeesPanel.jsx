import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '../api/employees'
import ConfirmModal from './ConfirmModal'

const ROLES = ['Manager', 'Staff']

const EMPTY_FORM = {
  name: '',
  username: '',
  phone: '',
  role: 'Staff',
  password: '',
  confirmPassword: '',
}

function getPasswordChecks(pw) {
  const value = String(pw || '')
  return [
    { id: 'length', label: 'At least 8 characters', ok: value.length >= 8 },
    { id: 'lower', label: 'One lowercase letter', ok: /[a-z]/.test(value) },
    { id: 'upper', label: 'One uppercase letter', ok: /[A-Z]/.test(value) },
    { id: 'number', label: 'One number', ok: /\d/.test(value) },
    { id: 'special', label: 'One special character (@$!%*?&)', ok: /[@$!%*?&]/.test(value) },
  ]
}

function isPasswordStrong(pw) {
  return getPasswordChecks(pw).every((check) => check.ok)
}

function passwordStrengthMeta(pw) {
  const checks = getPasswordChecks(pw)
  const score = checks.filter((c) => c.ok).length
  if (!pw) {
    return { score: 0, label: '', level: 'empty', checks }
  }
  if (score <= 2) return { score, label: 'Weak', level: 'weak', checks }
  if (score <= 4) return { score, label: 'Fair', level: 'fair', checks }
  return { score, label: 'Strong', level: 'strong', checks }
}

function roleClass(role) {
  if (role === 'Manager') return 'is-manager'
  if (role === 'Inspector') return 'is-inspector'
  return 'is-staff'
}

function normalizeSelectableRole(role) {
  return ROLES.includes(role) ? role : 'Staff'
}

function digitsOnlyPhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^63/, '').slice(0, 10)
}

function formatPhoneInput(value) {
  const digits = digitsOnlyPhone(value)
  return digits
}

function toStoredPhone(digits) {
  const clean = digitsOnlyPhone(digits)
  return clean ? `+63${clean}` : ''
}

function IconEye({ crossed = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {crossed && <path d="M4 20 20 4" />}
    </svg>
  )
}

function PasswordStrength({ password }) {
  const meta = passwordStrengthMeta(password)
  if (!password) return null

  return (
    <div className={`password-strength is-${meta.level}`} aria-live="polite">
      <div className="password-strength-head">
        <span className="password-strength-label">Strength</span>
        <strong className="password-strength-value">{meta.label}</strong>
      </div>
      <div className="password-strength-meter" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={`password-strength-bar${meta.score >= step ? ' is-filled' : ''}`}
          />
        ))}
      </div>
      <ul className="password-strength-checks">
        {meta.checks.map((check) => (
          <li key={check.id} className={check.ok ? 'is-ok' : ''}>
            {check.ok ? '✓' : '○'} {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  visible,
  onToggleVisible,
  showStrength = false,
  error,
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="login-password-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <IconEye crossed={visible} />
        </button>
      </div>
      {showStrength ? <PasswordStrength password={value} /> : null}
      {error || null}
    </label>
  )
}

export default function EmployeesPanel() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selected, setSelected] = useState(null)
  const [roleDraft, setRoleDraft] = useState('Staff')
  const [passwordDraft, setPasswordDraft] = useState({ password: '', confirm: '' })
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await fetchEmployees()
      setEmployees(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setError(err?.message || 'Could not load employees.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((emp) =>
      `${emp.name} ${emp.username} ${emp.role} ${emp.phone}`.toLowerCase().includes(q),
    )
  }, [employees, search])

  const activeCount = employees.filter((e) => e.active).length
  const inactiveCount = employees.length - activeCount

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormErrors(false)
    setShowCreatePassword(false)
    setShowCreateConfirm(false)
    setFormOpen(true)
    setMessage('')
  }

  const validateCreate = () => {
    return (
      form.name.trim() &&
      form.username.trim() &&
      digitsOnlyPhone(form.phone).length === 10 &&
      form.password === form.confirmPassword &&
      isPasswordStrong(form.password)
    )
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validateCreate()) {
      setFormErrors(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await createEmployee({
        name: form.name.trim(),
        username: form.username.trim(),
        phone: toStoredPhone(form.phone),
        role: form.role,
        password: form.password,
        active: true,
      })
      setEmployees((prev) => [created, ...prev.filter((row) => row.id !== created.id)])
      setFormOpen(false)
      setForm(EMPTY_FORM)
      setMessage('Employee added. Mobile can sign in with this account after sync.')
    } catch (err) {
      setError(err?.message || 'Could not add employee.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (emp) => {
    setBusyId(emp.id)
    setError('')
    try {
      const updated = await updateEmployee(emp.id, { active: !emp.active })
      setEmployees((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setMessage(updated.active ? 'Employee activated.' : 'Employee deactivated.')
      setSelected(null)
    } catch (err) {
      setError(err?.message || 'Could not update employee status.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRoleSave = async () => {
    if (!selected) return
    setBusyId(selected.id)
    setError('')
    try {
      const updated = await updateEmployee(selected.id, { role: roleDraft })
      setEmployees((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setMessage(`Role updated to ${updated.role}.`)
      setSelected(null)
    } catch (err) {
      setError(err?.message || 'Could not update role.')
    } finally {
      setBusyId(null)
    }
  }

  const handlePasswordSave = async () => {
    if (!selected) return
    if (
      passwordDraft.password !== passwordDraft.confirm ||
      !isPasswordStrong(passwordDraft.password)
    ) {
      setError('Password must be strong and match confirmation.')
      return
    }
    setBusyId(selected.id)
    setError('')
    try {
      await updateEmployee(selected.id, { password: passwordDraft.password })
      setMessage('Password updated.')
      setPasswordDraft({ password: '', confirm: '' })
      setSelected(null)
    } catch (err) {
      setError(err?.message || 'Could not update password.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    const emp = deleteTarget
    if (!emp) return
    setBusyId(emp.id)
    setError('')
    try {
      await deleteEmployee(emp.id)
      setEmployees((prev) => prev.filter((row) => row.id !== emp.id))
      setMessage('Employee removed.')
      setSelected(null)
      setDeleteTarget(null)
    } catch (err) {
      setError(err?.message || 'Could not remove employee.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="employees-panel">
      <header className="employees-panel-head">
        <div>
          <h3 className="dash-panel-title">Employees</h3>
          <p className="employees-panel-note">
            Shared with the mobile Employees tab. Accounts created here can sign in on mobile.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Add employee
        </button>
      </header>

      <div className="employees-toolbar">
        <label className="field search-field">
          <span className="field-label">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, username, or role"
          />
        </label>
        <div className="employees-stats">
          <span className="employees-stat is-active">{activeCount} active</span>
          <span className="employees-stat">{inactiveCount} inactive</span>
          <button type="button" className="btn-ghost btn-sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {message && <p className="employees-message">{message}</p>}
      {error && <p className="employees-error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading employees…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">
          {search ? 'No employees match your search.' : 'No employees yet. Add your first team member.'}
        </p>
      ) : (
        <div className="employees-list">
          {filtered.map((emp) => (
            <article key={emp.id} className="employees-row">
              <div className="employees-row-main">
                <div className="employees-avatar" aria-hidden="true">
                  {(emp.name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="employees-meta">
                  <strong>{emp.name}</strong>
                  <div className="employees-meta-tags">
                    <span className={`employees-role-pill ${roleClass(emp.role)}`}>{emp.role}</span>
                    <span className={`employees-status ${emp.active ? 'is-active' : ''}`}>
                      {emp.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="employees-meta-line">
                    @{emp.username}
                    <span aria-hidden="true"> · </span>
                    {emp.phone || 'No phone'}
                  </span>
                </div>
              </div>
              <div className="employees-row-actions">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={busyId === emp.id}
                  onClick={() => {
                    setSelected(emp)
                    setRoleDraft(normalizeSelectableRole(emp.role))
                    setPasswordDraft({ password: '', confirm: '' })
                    setShowResetPassword(false)
                    setShowResetConfirm(false)
                    setMessage('')
                    setError('')
                  }}
                >
                  Manage
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm btn-danger-outline"
                  disabled={busyId === emp.id}
                  onClick={() => setDeleteTarget(emp)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="employees-modal-backdrop" role="presentation" onClick={() => !saving && setFormOpen(false)}>
          <form
            className="employees-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <header className="employees-modal-head">
              <h4>Add employee</h4>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setFormOpen(false)} disabled={saving}>
                Close
              </button>
            </header>

            <label className="field">
              <span className="field-label">Full name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Juan Dela Cruz"
              />
              {formErrors && !form.name.trim() && <span className="field-error">Required</span>}
            </label>

            <label className="field">
              <span className="field-label">Username</span>
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="juan.d"
                autoComplete="off"
              />
              {formErrors && !form.username.trim() && <span className="field-error">Required</span>}
            </label>

            <label className="field">
              <span className="field-label">Phone (+63)</span>
              <div className="employees-phone-row">
                <span className="employees-phone-prefix">+63</span>
                <input
                  value={formatPhoneInput(form.phone)}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
                  }
                  placeholder="9XXXXXXXXX"
                  inputMode="numeric"
                />
              </div>
              {formErrors && digitsOnlyPhone(form.phone).length !== 10 && (
                <span className="field-error">Enter 10 digits starting with 9</span>
              )}
            </label>

            <fieldset className="employees-role-fieldset">
              <legend className="field-label">Role</legend>
              <div className="employees-role-options">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`employees-role-option${form.role === role ? ' is-active' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, role }))}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </fieldset>

            <PasswordField
              label="Password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              visible={showCreatePassword}
              onToggleVisible={() => setShowCreatePassword((v) => !v)}
              showStrength
              error={
                formErrors && !isPasswordStrong(form.password) ? (
                  <span className="field-error">Password does not meet all requirements</span>
                ) : null
              }
            />

            <PasswordField
              label="Confirm password"
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              visible={showCreateConfirm}
              onToggleVisible={() => setShowCreateConfirm((v) => !v)}
              error={
                formErrors && form.password !== form.confirmPassword ? (
                  <span className="field-error">Passwords do not match</span>
                ) : null
              }
            />

            <footer className="employees-modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Create employee'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {selected && (
        <div
          className="employees-modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="employees-modal employees-manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employees-manage-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="employees-manage-hero">
              <div className="employees-manage-hero-main">
                <div className="employees-manage-avatar" aria-hidden="true">
                  {(selected.name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="employees-manage-identity">
                  <div className="employees-manage-title-row">
                    <h4 id="employees-manage-title">{selected.name}</h4>
                    <span
                      className={`employees-status${selected.active ? ' is-active' : ''}`}
                    >
                      {selected.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="employees-manage-sub">
                    @{selected.username}
                    <span aria-hidden="true"> · </span>
                    {selected.phone || 'No phone'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <section className="employees-manage-section">
              <div className="employees-manage-section-head">
                <h5>Role</h5>
                <p>Controls what this person can do on the desk.</p>
              </div>
              <div className="employees-role-segment" role="group" aria-label="Employee role">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`employees-role-segment-btn${
                      roleDraft === role ? ' is-active' : ''
                    }`}
                    onClick={() => setRoleDraft(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary btn-sm employees-manage-action"
                disabled={busyId === selected.id || roleDraft === selected.role}
                onClick={handleRoleSave}
              >
                {busyId === selected.id ? 'Saving…' : 'Save role'}
              </button>
            </section>

            <section className="employees-manage-section">
              <div className="employees-manage-section-head">
                <h5>Password</h5>
                <p>Set a new login password for mobile and desk access.</p>
              </div>
              <div className="employees-manage-password-grid">
                <PasswordField
                  label="New password"
                  value={passwordDraft.password}
                  onChange={(e) =>
                    setPasswordDraft((prev) => ({ ...prev, password: e.target.value }))
                  }
                  visible={showResetPassword}
                  onToggleVisible={() => setShowResetPassword((v) => !v)}
                  showStrength
                />
                <PasswordField
                  label="Confirm password"
                  value={passwordDraft.confirm}
                  onChange={(e) =>
                    setPasswordDraft((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                  visible={showResetConfirm}
                  onToggleVisible={() => setShowResetConfirm((v) => !v)}
                />
              </div>
              <button
                type="button"
                className="btn-outline btn-sm employees-manage-action"
                disabled={busyId === selected.id}
                onClick={handlePasswordSave}
              >
                Update password
              </button>
            </section>

            <section className="employees-manage-section employees-manage-danger">
              <div className="employees-manage-section-head">
                <h5>Account access</h5>
                <p>
                  {selected.active
                    ? 'Deactivating blocks sign-in but keeps their record.'
                    : 'This account is inactive and cannot sign in.'}
                </p>
              </div>
              <button
                type="button"
                className={`btn-sm employees-manage-action${
                  selected.active ? ' btn-danger-outline' : ' btn-outline'
                }`}
                disabled={busyId === selected.id}
                onClick={() => handleToggleActive(selected)}
              >
                {selected.active ? 'Deactivate account' : 'Activate account'}
              </button>
            </section>
          </div>
        </div>
      )}
      {deleteTarget ? (
        <ConfirmModal
          title="Remove employee?"
          message={`Remove ${deleteTarget.name} (@${deleteTarget.username})? This cannot be undone.`}
          confirmLabel={busyId === deleteTarget.id ? 'Removing…' : 'Yes, remove'}
          cancelLabel="Cancel"
          danger
          confirmDisabled={busyId === deleteTarget.id}
          onCancel={() => {
            if (busyId === deleteTarget.id) return
            setDeleteTarget(null)
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </section>
  )
}
