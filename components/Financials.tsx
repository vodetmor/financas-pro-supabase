import React, { useState, useEffect } from 'react';
import {
  AppState, Transaction, TransactionType, TransactionStatus,
  Subscription, BillingCycle, ExpenseCategory,
} from '../types';
import {
  Plus, ArrowUpCircle, ArrowDownCircle, Trash2, AlertCircle,
  CheckSquare, Pencil, X, Calendar, RefreshCw, Filter, Search, DollarSign
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { DateRangePicker } from './DateRangePicker';
import { CURRENCIES, convertToBRL, fetchExchangeRates, formatCurrency } from '../services/currency';

interface FinancialsProps {
  data: AppState;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  onAddSubscription: (s: Omit<Subscription, 'id'>) => void;
  onUpdateSubscription: (id: string, updates: Partial<Subscription>) => void;
  onDeleteSubscription: (id: string) => void;
  visualizationCurrency: string;
  setVisualizationCurrency: (currency: string) => void;
}

export const Financials: React.FC<FinancialsProps> = ({
  data,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
  visualizationCurrency,
  setVisualizationCurrency
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'subscriptions'>('transactions');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Exchange Rates
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchExchangeRates().then(setRates);
  }, []);

  const convertFromBRL = (amount: number) => {
    if (visualizationCurrency === 'BRL') return amount;
    const rate = rates[visualizationCurrency] || 1;
    return amount / rate;
  };

  // Filters
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, type: 'tx' | 'sub', id: string | null }>({ isOpen: false, type: 'tx', id: null });

  // Forms
  const [txForm, setTxForm] = useState({
    description: '',
    amount: '', // Displayed amount (Foreign or BRL)
    currency: 'BRL',
    type: TransactionType.EXPENSE,
    category: ExpenseCategory.VARIABLE as string,
    date: new Date().toISOString().split('T')[0],
    status: TransactionStatus.PAID
  });

  const [subForm, setSubForm] = useState({
    name: '',
    amount: '',
    currency: 'BRL',
    billingCycle: BillingCycle.MONTHLY,
    firstPaymentDate: new Date().toISOString().split('T')[0],
    category: ExpenseCategory.FIXED,
    active: true,
    autoPay: true
  });

  // --- Helpers ---

  const getLatestTransaction = (subId: string) => {
    return data.transactions
      .filter(t => t.subscriptionId === subId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const handleStartEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setSubForm({
      name: sub.name,
      amount: (sub.originalAmount || sub.amount).toString(),
      currency: sub.currency || 'BRL',
      billingCycle: sub.billingCycle,
      firstPaymentDate: sub.firstPaymentDate,
      category: sub.category,
      active: sub.active,
      autoPay: sub.autoPay
    });
    setIsSubModalOpen(true);
  };

  const handleStartEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      description: tx.description,
      amount: (tx.originalAmount || tx.amount).toString(),
      currency: tx.currency || 'BRL',
      type: tx.type,
      category: tx.category as string,
      date: tx.date,
      status: tx.status
    });
    setIsTxModalOpen(true);
  };

  const handleDeleteClick = (id: string, type: 'tx' | 'sub' = 'sub') => {
    setDeleteConfirm({ isOpen: true, type, id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      if (deleteConfirm.type === 'sub') {
        onDeleteSubscription(deleteConfirm.id);
      } else {
        onDeleteTransaction(deleteConfirm.id);
      }
      setDeleteConfirm({ isOpen: false, type: 'tx', id: null });
    }
  };

  const togglePaymentStatus = (subId: string) => {
    const lastTx = getLatestTransaction(subId);
    if (lastTx) {
      const newStatus = lastTx.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID;
      onUpdateTransaction(lastTx.id, { status: newStatus });
    }
  };

  const handleManualPost = (sub: Subscription) => {
    const amountVal = sub.originalAmount || sub.amount;
    const currency = sub.currency || 'BRL';
    const finalAmount = currency === 'BRL' ? amountVal : convertToBRL(amountVal, currency, rates);

    onAddTransaction({
      description: sub.name,
      amount: finalAmount,
      originalAmount: amountVal,
      currency: currency,
      type: TransactionType.EXPENSE,
      category: sub.category,
      status: TransactionStatus.PAID,
      date: new Date().toISOString().split('T')[0],
      subscriptionId: sub.id
    });
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(txForm.amount);
    const finalAmount = txForm.currency === 'BRL' ? amountVal : convertToBRL(amountVal, txForm.currency, rates);

    const payload = {
      description: txForm.description,
      amount: finalAmount,
      originalAmount: amountVal,
      currency: txForm.currency,
      type: txForm.type,
      category: txForm.category,
      status: txForm.status,
      date: txForm.date,
    };

    if (editingTx) {
      onUpdateTransaction(editingTx.id, payload);
    } else {
      onAddTransaction(payload);
    }

    setIsTxModalOpen(false);
    setEditingTx(null);
    setTxForm({
      description: '',
      amount: '',
      currency: 'BRL',
      type: TransactionType.EXPENSE,
      category: ExpenseCategory.VARIABLE as string,
      date: new Date().toISOString().split('T')[0],
      status: TransactionStatus.PAID
    });
  };

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(subForm.amount);
    const finalAmount = subForm.currency === 'BRL' ? amountVal : convertToBRL(amountVal, subForm.currency, rates);

    const payload = {
      name: subForm.name,
      amount: finalAmount,
      originalAmount: amountVal,
      currency: subForm.currency,
      billingCycle: subForm.billingCycle,
      firstPaymentDate: subForm.firstPaymentDate,
      nextPaymentDate: subForm.firstPaymentDate,
      category: subForm.category,
      active: subForm.active,
      autoPay: subForm.autoPay
    };

    if (editingSub) {
      onUpdateSubscription(editingSub.id, { ...payload, nextPaymentDate: editingSub.nextPaymentDate });
    } else {
      onAddSubscription(payload);
    }
    setIsSubModalOpen(false);
    setEditingSub(null);
    setSubForm({
      name: '',
      amount: '',
      currency: 'BRL',
      billingCycle: BillingCycle.MONTHLY,
      firstPaymentDate: new Date().toISOString().split('T')[0],
      category: ExpenseCategory.FIXED,
      active: true,
      autoPay: true
    });
  };

  // --- Filter Logic ---
  const filterTransactions = (items: Transaction[]) => {
    let filtered = items;
    // Type Filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    // Date Filter (same as before)
    const now = new Date();
    if (dateFilter === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      filtered = filtered.filter(t => t.date === todayStr);
    } else if (dateFilter === 'WEEK') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => { const d = new Date(t.date + 'T00:00:00').getTime(); return d >= weekStart.getTime() && d <= weekEnd.getTime(); });
    } else if (dateFilter === 'MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => { const d = new Date(t.date + 'T00:00:00').getTime(); return d >= monthStart && d <= monthEnd; });
    } else if (dateFilter === 'CUSTOM' && customDates.start && customDates.end) {
      filtered = filtered.filter(t => t.date >= customDates.start && t.date <= customDates.end);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredTransactions = filterTransactions(data.transactions);
  const sortedSubs = [...data.subscriptions].sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime());

  // Calculations
  const totalIncome = filteredTransactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'sub' ? "Excluir Assinatura" : "Excluir Transação"}
        message={deleteConfirm.type === 'sub' ? "Tem certeza que deseja cancelar e remover esta assinatura?" : "Esta ação removerá permanentemente o registro financeiro."}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, type: 'tx', id: null })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-slate-500">Gestão de fluxo de caixa e recorrências</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          {/* Currency Selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <DollarSign size={16} className="text-slate-400" />
            <select
              value={visualizationCurrency}
              onChange={(e) => setVisualizationCurrency(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Fluxo de Caixa
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'subscriptions' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Assinaturas
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'transactions' ? (
        <>
          {/* Transactions Header/Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Entradas (Período)</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-2">+ {formatCurrency(convertFromBRL(totalIncome), visualizationCurrency)}</p>
                </div>
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><ArrowUpCircle size={24} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Saídas (Período)</p>
                  <p className="text-2xl font-bold text-rose-600 mt-2">- {formatCurrency(convertFromBRL(totalExpense), visualizationCurrency)}</p>
                </div>
                <div className="bg-rose-100 p-2 rounded-lg text-rose-600"><ArrowDownCircle size={24} /></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Saldo</p>
                  <p className={`text-2xl font-bold mt-2 ${balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                    {formatCurrency(convertFromBRL(balance), visualizationCurrency)}
                  </p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><DollarSign size={24} /></div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none"
                >
                  <option value="ALL">Todas as Transações</option>
                  <option value="INCOME">Apenas Entradas</option>
                  <option value="EXPENSE">Apenas Saídas</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 relative">
                {['TODAY', 'WEEK', 'MONTH', 'ALL'].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setDateFilter(f as any);
                      setShowCustomPicker(false);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${dateFilter === f ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                      }`}
                  >
                    {f === 'TODAY' ? 'Hoje' : f === 'WEEK' ? 'Semana' : f === 'MONTH' ? 'Mês' : 'Tudo'}
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCustomPicker(!showCustomPicker);
                  }}
                  className={`px-3 py-1 rounded transition-colors flex items-center justify-center ${showCustomPicker ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  title="Período Personalizado"
                >
                  <Calendar size={14} />
                </button>
                {showCustomPicker && (
                  <DateRangePicker
                    startDate={customDates.start}
                    endDate={customDates.end}
                    onChange={(start, end) => {
                      setCustomDates({ start, end });
                    }}
                    onClose={() => setShowCustomPicker(false)}
                    onApply={() => { setShowCustomPicker(false); setDateFilter('CUSTOM'); }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={() => { setEditingTx(null); setIsTxModalOpen(true); }}
              className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Nova Transação
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4 text-slate-700">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {t.description}
                      {t.currency && t.currency !== 'BRL' && (
                        <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                          {formatCurrency(t.originalAmount || 0, t.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${t.status === TransactionStatus.PAID
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                        }`}>
                        {t.status === TransactionStatus.PAID ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(convertFromBRL(t.amount), visualizationCurrency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEditTx(t)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(t.id, 'tx')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Nenhuma transação encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Subscriptions View */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingSub(null); setIsSubModalOpen(true); }}
              className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Nova Assinatura
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Serviço / Assinatura</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Ciclo</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Início</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Próx. Vencimento</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Valor</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Auto</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">Último Pagamento</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSubs.map((s) => {
                  const daysUntilDue = Math.ceil((new Date(s.nextPaymentDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;
                  const isLate = daysUntilDue < 0;
                  const lastTx = getLatestTransaction(s.id);

                  return (
                    <tr key={s.id} onClick={() => handleStartEdit(s)} className={`hover:bg-slate-50 transition-colors cursor-pointer ${!s.active ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap flex items-center gap-2">
                        {s.name}
                        {s.currency && s.currency !== 'BRL' && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1 rounded">{s.currency}</span>}
                        {!s.active && <span className="text-[10px] bg-slate-200 px-1.5 rounded text-slate-600">Inativo</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          {s.billingCycle}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {s.firstPaymentDate ? new Date(s.firstPaymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">{new Date(s.nextPaymentDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          {s.active && isDueSoon && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-1.5 rounded">Vence em {daysUntilDue}d</span>}
                          {s.active && isLate && <span className="text-xs font-bold text-rose-600 bg-rose-100 px-1.5 rounded">Atrasado</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                        {formatCurrency(convertFromBRL(s.amount), visualizationCurrency)}
                        {s.currency && s.currency !== 'BRL' && (
                          <div className="text-xs font-normal text-slate-400">
                            {formatCurrency(s.originalAmount || 0, s.currency)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.autoPay
                          ? <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded border border-blue-200">ON</span>
                          : <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded border border-slate-200">OFF</span>
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lastTx ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${lastTx.status === TransactionStatus.PAID ? 'text-green-600' : 'text-amber-600'}`}>
                              {lastTx.status === TransactionStatus.PAID ? 'Pago' : 'Pendente'}
                            </span>
                            <span className="text-xs text-slate-400">({new Date(lastTx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})</span>
                            {lastTx.status === TransactionStatus.PAID ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); togglePaymentStatus(s.id); }} className="p-1 hover:bg-rose-100 text-rose-500 rounded" title="Reportar Atraso">
                                <AlertCircle size={14} />
                              </button>
                            ) : (
                              <button type="button" onClick={(e) => { e.stopPropagation(); togglePaymentStatus(s.id); }} className="p-1 hover:bg-green-100 text-green-500 rounded" title="Confirmar Pagamento">
                                <CheckSquare size={14} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleManualPost(s); }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Lançar Manualmente Agora"
                          >
                            <ArrowDownCircle size={16} className="pointer-events-none" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(s); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={16} className="pointer-events-none" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(s.id, 'sub'); }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={16} className="pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {sortedSubs.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">Nenhuma assinatura cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- Modals --- */}

      {/* Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{editingTx ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button onClick={() => { setIsTxModalOpen(false); setEditingTx(null); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input required autoFocus className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} placeholder="Ex: Venda Site, Servidor, etc" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moeda</label>
                  <select className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={txForm.currency} onChange={e => setTxForm({ ...txForm, currency: e.target.value })}>
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                  <input required type="number" step="0.01" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} />
                  {txForm.currency !== 'BRL' && txForm.amount && (
                    <p className="text-xs text-slate-500 mt-1">
                      ≈ R$ {(parseFloat(txForm.amount) * (rates[txForm.currency] || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input required type="date" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value as TransactionType })}>
                    <option value={TransactionType.INCOME}>Entrada</option>
                    <option value={TransactionType.EXPENSE}>Saída</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={txForm.status} onChange={e => setTxForm({ ...txForm, status: e.target.value as TransactionStatus })}>
                    <option value={TransactionStatus.PAID}>Pago</option>
                    <option value={TransactionStatus.PENDING}>Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })}>
                    {Object.values(ExpenseCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Venda">Venda</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors mt-2">
                {editingTx ? 'Salvar Transação' : 'Criar Transação'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{editingSub ? 'Editar Assinatura' : 'Nova Assinatura'}</h3>
              <button onClick={() => { setIsSubModalOpen(false); setEditingSub(null); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Serviço</label>
                <input required autoFocus className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} placeholder="Ex: Adobe Creative Cloud" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moeda</label>
                  <select className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={subForm.currency} onChange={e => setSubForm({ ...subForm, currency: e.target.value })}>
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                  <input required type="number" step="0.01" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={subForm.amount} onChange={e => setSubForm({ ...subForm, amount: e.target.value })} />
                  {subForm.currency !== 'BRL' && subForm.amount && (
                    <p className="text-xs text-slate-500 mt-1">
                      ≈ R$ {(parseFloat(subForm.amount) * (rates[subForm.currency] || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ciclo</label>
                  <select className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={subForm.billingCycle} onChange={e => setSubForm({ ...subForm, billingCycle: e.target.value as BillingCycle })}>
                    <option value={BillingCycle.MONTHLY}>Mensal</option>
                    <option value={BillingCycle.YEARLY}>Anual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria de Despesa</label>
                  <select className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none" value={subForm.category} onChange={e => setSubForm({ ...subForm, category: e.target.value as ExpenseCategory })}>
                    {Object.values(ExpenseCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Início / Primeiro Pagamento</label>
                <input required type="date" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={subForm.firstPaymentDate} onChange={e => setSubForm({ ...subForm, firstPaymentDate: e.target.value })} />
                <p className="text-xs text-slate-400 mt-1">O próximo vencimento será calculado a partir desta data.</p>
              </div>

              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" checked={subForm.active} onChange={e => setSubForm({ ...subForm, active: e.target.checked })} />
                  <span className="text-sm text-slate-700">Ativa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" checked={subForm.autoPay} onChange={e => setSubForm({ ...subForm, autoPay: e.target.checked })} />
                  <span className="text-sm text-slate-700">Lançamento Automático</span>
                </label>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors mt-2">
                {editingSub ? 'Salvar Alterações' : 'Criar Assinatura'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};