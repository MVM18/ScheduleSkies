import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from '../styles/budget.module.css';

const CATEGORIES = [
  { key: 'Food', emoji: '🍔', color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'Transport', emoji: '🚕', color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'Tickets', emoji: '🎫', color: '#8B5CF6', bg: '#EDE9FE' },
  { key: 'Accommodation', emoji: '🏨', color: '#6366F1', bg: '#E0E7FF' },
  { key: 'Shopping', emoji: '🛍️', color: '#EC4899', bg: '#FCE7F3' },
  { key: 'Activities', emoji: '🎯', color: '#10B981', bg: '#D1FAE5' },
  { key: 'Other', emoji: '📦', color: '#64748B', bg: '#F1F5F9' },
];

const getCat = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[6];

const BudgetModal = ({ event, activities, onClose }) => {
  const [tab, setTab] = useState('overview');
  const [budget, setBudget] = useState({ total: 0, currency: '₱' });
  const [expenses, setExpenses] = useState([]);
  const [splits, setSplits] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [budgetInput, setBudgetInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Expense form
  const [showExpForm, setShowExpForm] = useState(false);
  const [editingExpId, setEditingExpId] = useState(null);
  const [expForm, setExpForm] = useState({ name: '', amount: '', category: 'Food', paid_by: '', activity_id: '', notes: '' });

  // Split form
  const [splitMode, setSplitMode] = useState('equal');
  const [splitExpenseId, setSplitExpenseId] = useState(null);
  const [customSplits, setCustomSplits] = useState({});

  const getAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = await getAuth();
    const res = await fetch(`/api/budget/manage?event_id=${event.id}`, { headers });
    if (res.ok) {
      const d = await res.json();
      const serverTotal = d.budget?.total || 0;

      // If no budget has been saved yet, use the event's price field as fallback
      if (!serverTotal && event.price) {
        const parsed = parseFloat(String(event.price).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          d.budget = { ...d.budget, total: parsed };
          setBudgetInput(String(parsed));
        } else {
          setBudgetInput(String(serverTotal || ''));
        }
      } else {
        setBudgetInput(String(serverTotal || ''));
      }

      setBudget(d.budget);
      setExpenses(d.expenses);
      setSplits(d.splits);
      setParticipants(d.participants);
    }
    setLoading(false);
  }, [event.id, event.price, getAuth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const remaining = (budget.total || 0) - totalSpent;
  const pct = budget.total > 0 ? Math.min((totalSpent / budget.total) * 100, 100) : 0;
  const currency = budget.currency || '₱';

  // Category breakdown
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount); });
  const maxCat = Math.max(...Object.values(catTotals), 1);

  // Per-person paid
  const personPaid = {};
  expenses.forEach(e => { personPaid[e.paid_by] = (personPaid[e.paid_by] || 0) + parseFloat(e.amount); });

  // Save budget
  const saveBudget = async () => {
    const headers = await getAuth();
    const res = await fetch('/api/budget/manage', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ event_id: event.id, total: budgetInput }),
    });
    if (res.ok) { const d = await res.json(); setBudget(d.budget); }
  };

  // Save expense
  const saveExpense = async (e) => {
    e.preventDefault();
    const headers = await getAuth();
    const method = editingExpId ? 'PUT' : 'POST';
    const body = { ...expForm, event_id: event.id, amount: parseFloat(expForm.amount) };
    if (editingExpId) body.id = editingExpId;
    const res = await fetch('/api/budget/expense', {
      method, headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (res.ok) { await fetchData(); setShowExpForm(false); setEditingExpId(null); setExpForm({ name: '', amount: '', category: 'Food', paid_by: '', activity_id: '', notes: '' }); }
  };

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    const headers = await getAuth();
    await fetch('/api/budget/expense', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ id }) });
    await fetchData();
  };

  const openEditExp = (exp) => {
    setExpForm({ name: exp.name, amount: String(exp.amount), category: exp.category, paid_by: exp.paid_by, activity_id: exp.activity_id || '', notes: exp.notes || '' });
    setEditingExpId(exp.id);
    setShowExpForm(true);
  };

  // Split expense
  const splitExpense = async (expenseId) => {
    if (participants.length === 0) return;
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const headers = await getAuth();
    let splitArr;
    if (splitMode === 'equal') {
      const each = parseFloat(exp.amount) / participants.length;
      splitArr = participants.map(p => ({ user_label: p, amount: Math.round(each * 100) / 100 }));
    } else {
      splitArr = participants.map(p => ({ user_label: p, amount: parseFloat(customSplits[p]) || 0 }));
    }
    await fetch('/api/budget/expense', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: expenseId, splits: splitArr }),
    });
    await fetchData();
    setSplitExpenseId(null);
  };

  // Toggle settle
  const toggleSettle = async (splitId, current) => {
    const headers = await getAuth();
    await fetch('/api/budget/settle', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ split_id: splitId, is_settled: !current }),
    });
    await fetchData();
  };

  // SVG gauge
  const radius = 65, stroke = 10, circ = 2 * Math.PI * radius;
  const gaugeColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : '#10B981';

  if (loading) {
    return (
      <div className={styles.budgetOverlay} onClick={onClose}>
        <div className={styles.budgetModal} onClick={e => e.stopPropagation()}>
          <div className={styles.budgetHeader}>
            <div className={styles.budgetHeaderTop}>
              <div><div className={styles.budgetHeaderLabel}>Budget Tracker</div><h2 className={styles.budgetHeaderTitle}>{event.title}</h2></div>
              <button className={styles.budgetCloseBtn} onClick={onClose}>✕</button>
            </div>
          </div>
          <div className={styles.budgetBody} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
            <span style={{ fontSize: '32px' }}>⏳</span><p>Loading budget...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.budgetOverlay} onClick={onClose}>
      <div className={styles.budgetModal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.budgetHeader}>
          <div className={styles.budgetHeaderTop}>
            <div>
              <div className={styles.budgetHeaderLabel}>Budget Tracker</div>
              <h2 className={styles.budgetHeaderTitle}>{event.title}</h2>
            </div>
            <button className={styles.budgetCloseBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.budgetTabs}>
          {[['overview', '📊', 'Overview'], ['expenses', '💳', 'Expenses'], ['splits', '✂️', 'Splits']].map(([k, icon, label]) => (
            <button key={k} className={`${styles.budgetTab} ${tab === k ? styles.budgetTabActive : ''}`} onClick={() => setTab(k)}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.budgetBody}>

          {/* ===== OVERVIEW TAB ===== */}
          {tab === 'overview' && (
            <>
              {/* Budget input */}
              <div className={styles.budgetInputRow}>
                <label>Total Budget</label>
                <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="0" />
                <button className={styles.budgetSaveBtn} onClick={saveBudget}>Save</button>
              </div>

              {/* Gauge */}
              <div className={styles.gaugeContainer}>
                <div className={styles.gaugeRing}>
                  <svg width="160" height="160">
                    <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
                    <circle cx="80" cy="80" r={radius} fill="none" stroke={gaugeColor} strokeWidth={stroke}
                      strokeDasharray={circ} strokeDashoffset={circ - (circ * pct / 100)} strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }} />
                  </svg>
                  <div className={styles.gaugeCenter}>
                    <span className={styles.gaugeSpent}>{currency}{totalSpent.toLocaleString()}</span>
                    <span className={styles.gaugeLabel}>of {currency}{(budget.total || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className={styles.gaugeStats}>
                  <div className={styles.gaugeStat}>
                    <span className={styles.gaugeStatValue} style={{ color: '#10B981' }}>{currency}{Math.max(remaining, 0).toLocaleString()}</span>
                    <span className={styles.gaugeStatLabel}>Remaining</span>
                  </div>
                  <div className={styles.gaugeStat}>
                    <span className={styles.gaugeStatValue}>{expenses.length}</span>
                    <span className={styles.gaugeStatLabel}>Expenses</span>
                  </div>
                  <div className={styles.gaugeStat}>
                    <span className={styles.gaugeStatValue}>{Math.round(pct)}%</span>
                    <span className={styles.gaugeStatLabel}>Used</span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              {Object.keys(catTotals).length > 0 && (
                <div className={styles.categoryBreakdown}>
                  <div className={styles.categoryTitle}>Spending by Category</div>
                  {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                    const c = getCat(cat);
                    return (
                      <div key={cat} className={styles.categoryBar}>
                        <div className={styles.categoryIcon} style={{ background: c.bg }}>{c.emoji}</div>
                        <div className={styles.categoryInfo}>
                          <div className={styles.categoryName}>{cat}</div>
                          <div className={styles.categoryTrack}>
                            <div className={styles.categoryFill} style={{ width: `${(total / maxCat) * 100}%`, background: c.color }} />
                          </div>
                        </div>
                        <span className={styles.categoryAmount}>{currency}{total.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Per-person */}
              {Object.keys(personPaid).length > 0 && (
                <div className={styles.categoryBreakdown}>
                  <div className={styles.categoryTitle}>Who Paid What</div>
                  <div className={styles.personSummary}>
                    {Object.entries(personPaid).map(([name, amt]) => (
                      <div key={name} className={styles.personRow}>
                        <div className={styles.splitAvatar}>{name[0]?.toUpperCase()}</div>
                        <span className={styles.personName}>{name}</span>
                        <span className={styles.personPaid}>{currency}{amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== EXPENSES TAB ===== */}
          {tab === 'expenses' && (
            <>
              {expenses.length === 0 && !showExpForm ? (
                <div className={styles.emptyExpenses}>
                  <span className="emptyIcon">💸</span>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#475569' }}>No expenses yet</p>
                  <p style={{ fontSize: '12px' }}>Add your first expense below</p>
                </div>
              ) : (
                <div className={styles.expenseList}>
                  {expenses.map(exp => {
                    const c = getCat(exp.category);
                    return (
                      <div key={exp.id} className={styles.expenseCard}>
                        <div className={styles.expenseIcon} style={{ background: c.bg }}>{c.emoji}</div>
                        <div className={styles.expenseInfo}>
                          <div className={styles.expenseName}>{exp.name}</div>
                          <div className={styles.expenseMeta}>
                            <span className={styles.catBadge} style={{ background: c.bg, color: c.color }}>{exp.category}</span>
                            <span>Paid by {exp.paid_by}</span>
                            {exp.notes && <span>· {exp.notes}</span>}
                          </div>
                        </div>
                        <span className={styles.expenseAmount}>{currency}{parseFloat(exp.amount).toLocaleString()}</span>
                        <div className={styles.expenseActions}>
                          <button className={styles.expenseActionBtn} onClick={() => openEditExp(exp)}>✎</button>
                          <button className={`${styles.expenseActionBtn} ${styles.deleteExpBtn}`} onClick={() => deleteExpense(exp.id)}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add/Edit form */}
              {showExpForm ? (
                <div className={styles.expenseFormCard}>
                  <h4>{editingExpId ? 'Edit Expense' : 'Add Expense'}</h4>
                  <form onSubmit={saveExpense}>
                    <div className={styles.expenseFormGrid}>
                      <div className="fullWidth">
                        <label>Expense Name *</label>
                        <input required value={expForm.name} onChange={e => setExpForm({ ...expForm, name: e.target.value })} placeholder="e.g. Taxi fare" />
                      </div>
                      <div>
                        <label>Amount *</label>
                        <input required type="number" step="0.01" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0.00" />
                      </div>
                      <div>
                        <label>Category</label>
                        <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
                          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.key}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Paid By</label>
                        <input value={expForm.paid_by} onChange={e => setExpForm({ ...expForm, paid_by: e.target.value })} placeholder="Your name" list="participantsList" />
                        <datalist id="participantsList">{participants.map(p => <option key={p} value={p} />)}</datalist>
                      </div>
                      <div>
                        <label>Linked Activity</label>
                        <select value={expForm.activity_id} onChange={e => setExpForm({ ...expForm, activity_id: e.target.value })}>
                          <option value="">None</option>
                          {(activities || []).map(a => <option key={a.id} value={a.id}>{a.activity_name}</option>)}
                        </select>
                      </div>
                      <div className="fullWidth">
                        <label>Notes</label>
                        <input value={expForm.notes} onChange={e => setExpForm({ ...expForm, notes: e.target.value })} placeholder="Optional notes" />
                      </div>
                    </div>
                    <div className={styles.expenseFormFooter}>
                      <button type="button" style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }} onClick={() => { setShowExpForm(false); setEditingExpId(null); }}>Cancel</button>
                      <button type="submit" className={styles.budgetSaveBtn}>{editingExpId ? 'Save Changes' : 'Add Expense'}</button>
                    </div>
                  </form>
                </div>
              ) : (
                <button className={styles.addExpenseBtn} onClick={() => { setExpForm({ name: '', amount: '', category: 'Food', paid_by: '', activity_id: '', notes: '' }); setEditingExpId(null); setShowExpForm(true); }}>
                  ⊕ Add Expense
                </button>
              )}
            </>
          )}

          {/* ===== SPLITS TAB ===== */}
          {tab === 'splits' && (
            <>
              {expenses.length === 0 ? (
                <div className={styles.emptyExpenses}>
                  <span className="emptyIcon">✂️</span>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#475569' }}>No expenses to split</p>
                  <p style={{ fontSize: '12px' }}>Add expenses first in the Expenses tab</p>
                </div>
              ) : (
                <>
                  {/* Split mode selector */}
                  <div className={styles.splitSection}>
                    <div className={styles.splitTitle}>Split Method</div>
                    <div className={styles.splitModeSelector}>
                      <button className={`${styles.splitModeBtn} ${splitMode === 'equal' ? styles.splitModeBtnActive : ''}`} onClick={() => setSplitMode('equal')}>⚖️ Equal</button>
                      <button className={`${styles.splitModeBtn} ${splitMode === 'custom' ? styles.splitModeBtnActive : ''}`} onClick={() => setSplitMode('custom')}>✏️ Custom</button>
                    </div>

                    {/* Expenses to split */}
                    {expenses.map(exp => {
                      const expSplits = splits.filter(s => s.expense_id === exp.id);
                      const c = getCat(exp.category);
                      const isSplitting = splitExpenseId === exp.id;
                      return (
                        <div key={exp.id} style={{ marginBottom: '14px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e8edf2' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '16px' }}>{c.emoji}</span>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{exp.name}</span>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>{currency}{parseFloat(exp.amount).toLocaleString()}</span>
                          </div>

                          {expSplits.length > 0 ? (
                            <div>
                              {expSplits.map(s => (
                                <div key={s.id} className={styles.splitParticipant}>
                                  <div className={styles.splitAvatar}>{s.user_label[0]?.toUpperCase()}</div>
                                  <span className={styles.splitName}>{s.user_label}</span>
                                  <span className={styles.splitAmount}>{currency}{parseFloat(s.amount).toLocaleString()}</span>
                                  <button className={`${styles.settleBtn} ${s.is_settled ? styles.settled : ''}`} onClick={() => toggleSettle(s.id, s.is_settled)}>
                                    {s.is_settled ? '✓ Settled' : 'Settle'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : isSplitting ? (
                            <div>
                              {participants.map(p => (
                                <div key={p} className={styles.splitParticipant}>
                                  <div className={styles.splitAvatar}>{p[0]?.toUpperCase()}</div>
                                  <span className={styles.splitName}>{p}</span>
                                  {splitMode === 'equal' ? (
                                    <span className={styles.splitAmount}>{currency}{(parseFloat(exp.amount) / participants.length).toFixed(2)}</span>
                                  ) : (
                                    <input className={styles.splitAmountInput} type="number" step="0.01" placeholder="0" value={customSplits[p] || ''} onChange={e => setCustomSplits({ ...customSplits, [p]: e.target.value })} />
                                  )}
                                </div>
                              ))}
                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                <button style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }} onClick={() => setSplitExpenseId(null)}>Cancel</button>
                                <button className={styles.budgetSaveBtn} onClick={() => splitExpense(exp.id)}>Apply Split</button>
                              </div>
                            </div>
                          ) : (
                            <button style={{ width: '100%', padding: '8px', border: '1.5px dashed #cbd5e1', borderRadius: '10px', background: 'transparent', color: '#10B981', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                              onClick={() => { setSplitExpenseId(exp.id); setCustomSplits({}); }}>
                              ✂️ Split this expense
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Settlement Summary */}
                  {splits.length > 0 && (
                    <div className={styles.categoryBreakdown}>
                      <div className={styles.categoryTitle}>Settlement Summary</div>
                      {(() => {
                        const balances = {};
                        expenses.forEach(exp => {
                          const expSplits = splits.filter(s => s.expense_id === exp.id);
                          expSplits.forEach(s => {
                            if (s.user_label !== exp.paid_by && !s.is_settled) {
                              const key = `${s.user_label}→${exp.paid_by}`;
                              balances[key] = (balances[key] || 0) + parseFloat(s.amount);
                            }
                          });
                        });
                        const entries = Object.entries(balances);
                        if (entries.length === 0) return <p style={{ fontSize: '13px', color: '#10B981', fontWeight: 700, textAlign: 'center', padding: '12px' }}>✅ All settled!</p>;
                        return entries.map(([key, amt]) => {
                          const [from, to] = key.split('→');
                          return (
                            <div key={key} className={styles.settlementCard}>
                              <div className={styles.splitAvatar} style={{ background: 'linear-gradient(135deg, #EF4444, #F59E0B)' }}>{from[0]}</div>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>{from}</span>
                              <span className={styles.settlementArrow}>owes →</span>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>{to}</span>
                              <span className={styles.settlementAmount}>{currency}{amt.toFixed(2)}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetModal;
