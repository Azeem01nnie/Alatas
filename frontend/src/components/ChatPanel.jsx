import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listChatMessages,
  listChatThreads,
  postChatMessage,
  setChatThreadArchived,
} from '../api/chat'

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatPanel({ adminName = 'Alatas Admin' }) {
  const [view, setView] = useState('active') // 'active' | 'archived'
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')
  const [startThreadId, setStartThreadId] = useState('')
  const bottomRef = useRef(null)

  const isArchivedView = view === 'archived'

  const activeThread = useMemo(
    () => threads.find((t) => t.threadId === activeThreadId) || null,
    [threads, activeThreadId],
  )

  const loadThreads = useCallback(async () => {
    try {
      const rows = await listChatThreads({ archived: isArchivedView })
      const list = Array.isArray(rows) ? rows : []
      setThreads(list)
      setActiveThreadId((prev) => {
        if (prev && list.some((t) => t.threadId === prev)) return prev
        return list[0]?.threadId || null
      })
      setError('')
    } catch (err) {
      setError(err?.message || 'Could not load chat threads.')
    } finally {
      setLoadingThreads(false)
    }
  }, [isArchivedView])

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    try {
      const rows = await listChatMessages({ threadId, limit: 300 })
      setMessages(Array.isArray(rows) ? rows : [])
      setError('')
    } catch (err) {
      setError(err?.message || 'Could not load messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    setLoadingThreads(true)
    setActiveThreadId(null)
    setMessages([])
    loadThreads()
    const timer = window.setInterval(loadThreads, 5000)
    return () => window.clearInterval(timer)
  }, [loadThreads])

  useEffect(() => {
    if (!activeThreadId) return undefined
    loadMessages(activeThreadId)
    const timer = window.setInterval(() => loadMessages(activeThreadId), 4000)
    return () => window.clearInterval(timer)
  }, [activeThreadId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages.length, activeThreadId])

  const handleSend = async (e) => {
    e.preventDefault()
    if (isArchivedView) return
    const text = draft.trim()
    const threadId = activeThreadId || startThreadId.trim().toLowerCase()
    if (!text || !threadId || sending) return

    setSending(true)
    setError('')
    try {
      const created = await postChatMessage({
        threadId,
        senderRole: 'admin',
        senderName: adminName,
        senderUsername: 'admin',
        text,
      })
      setDraft('')
      setStartThreadId('')
      setActiveThreadId(threadId)
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [String(m.id), m]))
        byId.set(String(created.id), created)
        return [...byId.values()].sort((a, b) =>
          String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
        )
      })
      await loadThreads()
    } catch (err) {
      setError(err?.message || 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const handleArchiveToggle = async () => {
    if (!activeThreadId || archiving) return
    setArchiving(true)
    setError('')
    try {
      await setChatThreadArchived(activeThreadId, !isArchivedView)
      setActiveThreadId(null)
      setMessages([])
      await loadThreads()
    } catch (err) {
      setError(err?.message || (isArchivedView ? 'Could not restore chat.' : 'Could not archive chat.'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-panel-head">
        <div>
          <h3 className="dash-panel-title">Team chat</h3>
          <p className="chat-panel-note">
            Message mobile employees. Each employee has their own conversation thread.
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={loadThreads} disabled={loadingThreads}>
          Refresh
        </button>
      </header>

      {error ? <p className="chat-error">{error}</p> : null}

      <div className="chat-layout">
        <aside className="chat-threads">
          <div className="chat-view-tabs" role="tablist" aria-label="Chat folders">
            <button
              type="button"
              role="tab"
              aria-selected={!isArchivedView}
              className={`chat-view-tab${!isArchivedView ? ' is-active' : ''}`}
              onClick={() => setView('active')}
            >
              Active
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isArchivedView}
              className={`chat-view-tab${isArchivedView ? ' is-active' : ''}`}
              onClick={() => setView('archived')}
            >
              Archived
            </button>
          </div>

          <h4 className="chat-side-title">
            {isArchivedView ? 'Archived conversations' : 'Conversations'}
          </h4>
          {loadingThreads ? (
            <p className="chat-empty">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="chat-empty">
              {isArchivedView
                ? 'No archived chats.'
                : 'No chats yet. Start one with an employee username.'}
            </p>
          ) : (
            <ul className="chat-thread-list">
              {threads.map((thread) => (
                <li key={thread.threadId}>
                  <button
                    type="button"
                    className={`chat-thread-btn${activeThreadId === thread.threadId ? ' is-active' : ''}`}
                    onClick={() => setActiveThreadId(thread.threadId)}
                  >
                    <strong>{thread.employeeName || thread.threadId}</strong>
                    <span>{thread.lastMessage?.text || 'No messages'}</span>
                    <em>{formatTime(thread.lastAt)}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isArchivedView ? (
            <div className="chat-start-thread">
              <label className="field">
                <span className="field-label">Start / open thread</span>
                <input
                  value={startThreadId}
                  onChange={(e) => setStartThreadId(e.target.value)}
                  placeholder="Employee username"
                />
              </label>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={!startThreadId.trim()}
                onClick={() => setActiveThreadId(startThreadId.trim().toLowerCase())}
              >
                Open
              </button>
            </div>
          ) : null}
        </aside>

        <div className="chat-conversation">
          <header className="chat-conversation-head">
            <div className="chat-conversation-title">
              <strong>
                {activeThread?.employeeName || activeThreadId || 'Select a conversation'}
              </strong>
              {activeThreadId ? <span>@{activeThreadId}</span> : null}
              {isArchivedView && activeThreadId ? (
                <span className="chat-archived-badge">Archived</span>
              ) : null}
            </div>
            {activeThreadId ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={handleArchiveToggle}
                disabled={archiving}
              >
                {archiving
                  ? isArchivedView
                    ? 'Restoring…'
                    : 'Archiving…'
                  : isArchivedView
                    ? 'Restore'
                    : 'Archive'}
              </button>
            ) : null}
          </header>

          <div className="chat-messages">
            {!activeThreadId ? (
              <p className="chat-empty">
                {isArchivedView
                  ? 'Pick an archived conversation to review.'
                  : 'Pick a conversation or open a thread by username.'}
              </p>
            ) : loadingMessages && messages.length === 0 ? (
              <p className="chat-empty">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="chat-empty">No messages yet. Say hello to this employee.</p>
            ) : (
              messages.map((msg) => {
                const mine = msg.senderRole === 'admin'
                return (
                  <div
                    key={msg.id}
                    className={`chat-bubble-row${mine ? ' is-mine' : ''}`}
                  >
                    <div className={`chat-bubble${mine ? ' is-mine' : ''}`}>
                      <span className="chat-bubble-name">
                        {msg.senderName || (mine ? 'Admin' : 'Employee')}
                      </span>
                      <p>{msg.text}</p>
                      <time>{formatTime(msg.createdAt)}</time>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {isArchivedView ? (
            <div className="chat-archived-banner">
              This conversation is archived. Restore it to reply, or wait for the employee to message again.
            </div>
          ) : (
            <form className="chat-composer" onSubmit={handleSend}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  activeThreadId || startThreadId.trim()
                    ? 'Type a reply…'
                    : 'Enter an employee username above, then type a message'
                }
                disabled={sending}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={sending || !draft.trim() || !(activeThreadId || startThreadId.trim())}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
