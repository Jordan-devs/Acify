import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { STATUS_LABEL, formatDate, initials, isOverdue, shortName } from '../utils.js';
import { ActionableModal, DeleteModal } from './Modals.jsx';

const FILTERS = [
  ['all', 'All'],
  ['open', 'Open'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
];

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />
  </svg>
);

export default function Dashboard({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // { item? } for create/edit
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null); // { id, message }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const toastTimer = useRef();

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([api.list(), api.users()]);
      setItems(a.actionables);
      setUsers(u.users);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: items.length,
    open: items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    done: items.filter((i) => i.status === 'done').length,
  }), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) =>
      (filter === 'all' || i.status === filter) &&
      (!q || `${i.title} ${i.description} ${i.ownerName || ''}`.toLowerCase().includes(q))
    );
  }, [items, filter, query]);

  const replace = (updated) => setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));

  const toggleDone = async (item) => {
    const status = item.status === 'done' ? 'open' : 'done';
    replace({ ...item, status }); // optimistic
    try {
      const { actionable } = await api.update(item.id, { status });
      replace(actionable);
    } catch {
      replace(item);
    }
  };

  const saved = (actionable, isNew) => {
    setItems((list) => (isNew ? [actionable, ...list] : list.map((i) => (i.id === actionable.id ? actionable : i))));
    setModal(null);
  };

  const confirmDelete = async () => {
    const item = deleting;
    await api.remove(item.id);
    setItems((list) => list.filter((i) => i.id !== item.id));
    setDeleting(null);
    clearTimeout(toastTimer.current);
    setToast({ id: item.id, message: 'Actionable deleted' });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const undo = async () => {
    const id = toast.id;
    clearTimeout(toastTimer.current);
    setToast(null);
    try { await api.restore(id); } finally { load(); }
  };

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand"><span className="logo">A</span><span className="brand-name">Actify</span></div>
          <div className="topbar-right">
            <div className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" placeholder="Search actionables" aria-label="Search actionables" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="menu-wrap">
              <button className="avatar avatar-lg" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} title={user.name}>
                {initials(user.name)}
              </button>
              {menuOpen && (
                <div className="menu" role="menu">
                  <p className="menu-name">{user.name}<span>{user.email}</span></p>
                  <button role="menuitem" onClick={onLogout}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Actionables</h1>
            <p className="muted">Everything your team needs to act on, in one place.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setModal({})}>
            <span aria-hidden="true">+</span> New actionable
          </button>
        </div>

        <div className="pills" role="tablist" aria-label="Filter by status">
          {FILTERS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={filter === key} className={`chip ${filter === key ? 'chip-active' : ''}`} onClick={() => setFilter(key)}>
              {label} · {counts[key]}
            </button>
          ))}
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="col-check"><span className="sr-only">Done</span></th>
                  <th>Actionable</th><th>Owner</th><th>Status</th><th>Due</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const overdue = isOverdue(a);
                  const mine = a.createdBy === user.id;
                  const canStatus = mine || a.ownerId === user.id;
                  return (
                    <tr key={a.id}>
                      <td className="col-check">
                        <input type="checkbox" className="check" checked={a.status === 'done'} disabled={!canStatus} onChange={() => toggleDone(a)} aria-label={`Mark "${a.title}" as done`} />
                      </td>
                      <td>
                        <div className={`row-title ${a.status === 'done' ? 'struck' : ''}`}>{a.title}</div>
                        {a.description && <div className="row-desc">{a.description}</div>}
                      </td>
                      <td>
                        {a.ownerName ? (
                          <span className="owner"><span className="avatar">{initials(a.ownerName)}</span>{shortName(a.ownerName)}</span>
                        ) : <span className="muted">Unassigned</span>}
                      </td>
                      <td><span className={`pill pill-${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
                      <td>
                        <div className={overdue ? 'due overdue' : 'due'}>{formatDate(a.dueDate)}</div>
                        {overdue && <div className="overdue-label">Overdue</div>}
                      </td>
                      <td className="col-actions">
                        {canStatus && (
                          <button className="icon-btn" aria-label={`Edit "${a.title}"`} onClick={() => setModal({ item: a })}><PencilIcon /></button>
                        )}
                        {mine && (
                          <button className="icon-btn icon-danger" aria-label={`Delete "${a.title}"`} onClick={() => setDeleting(a)}><TrashIcon /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !visible.length && (
            <p className="empty">
              {loadError || (items.length ? 'No actionables match your search or filter.' : 'Nothing here yet. Add your first actionable.')}
            </p>
          )}
        </div>
        <p className="muted footnote">Showing {visible.length} of {items.length} actionables</p>
      </main>

      {modal && <ActionableModal item={modal.item} users={users} currentUserId={user.id} onClose={() => setModal(null)} onSaved={saved} />}
      {deleting && <DeleteModal item={deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} />}
      {toast && (
        <div className="toast" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
          <span>{toast.message}</span>
          <button onClick={undo}>Undo</button>
        </div>
      )}
    </>
  );
}
