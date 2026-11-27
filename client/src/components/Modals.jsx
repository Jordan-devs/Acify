import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { shortDay, timeAgo } from '../utils.js';

function Overlay({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function ActionableModal({ item, users, currentUserId, onClose, onSaved }) {
  const isEdit = !!item;
  // The owner (not the creator) can only change the status
  const statusOnly = isEdit && item.createdBy !== currentUserId;
  const [form, setForm] = useState({
    title: item?.title || '',
    description: item?.description || '',
    ownerId: item?.ownerId || (isEdit ? '' : currentUserId),
    dueDate: item?.dueDate || '',
    status: item?.status || 'open',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef();
  useEffect(() => titleRef.current?.focus(), []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Enter a title.');
    setBusy(true);
    setError('');
    const body = statusOnly ? { status: form.status } : {
      title: form.title,
      description: form.description,
      ownerId: form.ownerId || null,
      dueDate: form.dueDate || null,
      ...(isEdit ? { status: form.status } : {}),
    };
    try {
      const { actionable } = isEdit ? await api.update(item.id, body) : await api.create(body);
      onSaved(actionable, !isEdit);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} label={isEdit ? 'Edit actionable' : 'New actionable'}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <div className="modal-head">
            <div>
              <h2 className="modal-title">{isEdit ? 'Edit actionable' : 'New actionable'}</h2>
              <p className="modal-sub">
                {statusOnly ? 'You own this one, so you can update its status.' : isEdit ? `Created ${shortDay(item.createdAt)} · Updated ${timeAgo(item.updatedAt)}` : 'Add something that needs doing.'}
              </p>
            </div>
            <button type="button" className="close" aria-label="Close" onClick={onClose}>✕</button>
          </div>

          <div className="field">
            <label htmlFor="title">Title <span className="req">*</span></label>
            <input id="title" ref={titleRef} className="input" maxLength={200} disabled={statusOnly} value={form.title} onChange={set('title')} />
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea id="desc" className="input textarea" placeholder="Add context or links" maxLength={2000} disabled={statusOnly} value={form.description} onChange={set('description')} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="owner">Owner</label>
              <select id="owner" className="input" disabled={statusOnly} value={form.ownerId || ''} onChange={set('ownerId')}>
                <option value="">Select owner</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="due">Due date</label>
              <input id="due" type="date" className="input" disabled={statusOnly} value={form.dueDate} onChange={set('dueDate')} />
            </div>
          </div>
          {isEdit ? (
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" className="input" value={form.status} onChange={set('status')}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          ) : (
            <p className="hint">New actionables start as <strong>Open</strong>.</p>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{isEdit ? 'Save changes' : 'Create actionable'}</button>
        </div>
      </form>
    </Overlay>
  );
}

export function DeleteModal({ item, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async () => {
    setBusy(true);
    try { await onConfirm(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Overlay onClose={onClose} label="Delete actionable">
      <div className="modal-body delete-body">
        <div className="trash-circle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
        </div>
        <h2 className="modal-title">Delete this actionable?</h2>
        <p className="modal-sub">“{item.title}” will be permanently removed for everyone. This can’t be undone.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="modal-foot split">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={go} disabled={busy}>Delete</button>
      </div>
    </Overlay>
  );
}
