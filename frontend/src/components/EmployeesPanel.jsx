import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEmployee,
  deleteEmployee,
  fetchEmployees,
  updateEmployee,
} from '../api/employees'

const ROLES = ['Manager', 'Inspector', 'Staff']

const EMPTY_FORM = {
  name: '',
  username: '',
  phone: '',
  role: 'Inspector',
  password: '',
  confirmPassword: '',
}

function isPasswordStrong(pw) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(pw)
}

function roleClass(role) {
  if (role === 'Manager') return 'is-manager'
  if (role === 'Inspector') return 'is-inspector'
  return 'is-staff'
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
  const [roleDraft, setRoleDraft] = useState('Inspector')
  const [passwordDraft, setPasswordDraft] = useState({ password: '', confirm: '' })

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

  const handleDelete = async (emp) => {
    const ok = window.confirm(`Remove ${emp.name} (@${emp.username})? This cannot be undone.`)
    if (!ok) return
    setBusyId(emp.id)
    setError('')
    try {
      await deleteEmployee(emp.id)
      setEmployees((prev) => prev.filter((row) => row.id !== emp.id))
      setMessage('Employee removed.')
      setSelected(null)
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
                  <strong>
                    {emp.name}
                    <span className={`employees-role-pill ${roleClass(emp.role)}`}>{emp.role}</span>
                  </strong>
                  <span>@{emp.username}</span>
                  <span>{emp.phone || 'No phone'}</span>
                </div>
              </div>
              <div className="employees-row-actions">
                <span className={`employees-status ${emp.active ? 'is-active' : ''}`}>
                  {emp.active ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={busyId === emp.id}
                  onClick={() => {
                    setSelected(emp)
                    setRoleDraft(emp.role)
                    setPasswordDraft({ password: '', confirm: '' })
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
                  onClick={() => handleDelete(emp)}
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

            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
              />
              {formErrors && !isPasswordStrong(form.password) && (
                <span className="field-error">
                  Use 8+ chars with upper, lower, number, and special character
                </span>
              )}
            </label>

            <label className="field">
              <span className="field-label">Confirm password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
              {formErrors && form.password !== form.confirmPassword && (
                <span className="field-error">Passwords do not match</span>
              )}
            </label>

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
        <div className="employees-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div className="employees-modal" onClick={(e) => e.stopPropagation()}>
            <header className="employees-modal-head">
              <h4>Manage {selected.name}</h4>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </header>

            <p className="employees-manage-sub">@{selected.username} · {selected.phone || 'No phone'}</p>

            <div className="employees-manage-block">
              <h5>Role</h5>
              <div className="employees-role-options">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`employees-role-option${roleDraft === role ? ' is-active' : ''}`}
                    onClick={() => setRoleDraft(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={busyId === selected.id || roleDraft === selected.role}
                onClick={handleRoleSave}
              >
                Save role
              </button>
            </div>

            <div className="employees-manage-block">
              <h5>Reset password</h5>
              <label className="field">
                <span className="field-label">New password</span>
                <input
                  type="password"
                  value={passwordDraft.password}
                  onChange={(e) =>
                    setPasswordDraft((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Confirm</span>
                <input
                  type="password"
                  value={passwordDraft.confirm}
                  onChange={(e) =>
                    setPasswordDraft((prev) => ({ ...prev, confirm: e.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={busyId === selected.id}
                onClick={handlePasswordSave}
              >
                Update password
              </button>
            </div>

            <div className="employees-manage-block">
              <h5>Access</h5>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={busyId === selected.id}
                onClick={() => handleToggleActive(selected)}
              >
                {selected.active ? 'Deactivate account' : 'Activate account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
