
import React, { useState, useMemo, useEffect } from 'react';
import { Service, ServiceStatus, AppState, ServiceStep, ServiceParticipant, TransactionType, Transaction, TransactionStatus, ExpenseCategory } from '../types';
import {
  CheckCircle, Clock, AlertCircle, PlayCircle, Plus, X,
  ChevronRight, Calendar, DollarSign, Users, ListTodo,
  MoreVertical, Trash2, TrendingUp, BarChart2, Layers, Activity, PieChart as PieChartIcon, Save, ArrowRight
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, LineChart
} from 'recharts';
import { ConfirmModal } from './ConfirmModal';
import { DateRangePicker } from './DateRangePicker';
import { CURRENCIES, convertToBRL, fetchExchangeRates, formatCurrency } from '../services/currency';

// COLORS - STRICT STYLE GUIDE
const COL_REVENUE = '#3b82f6'; // Blue
const COL_EXPENSE = '#f43f5e'; // Red (Expense)
const COL_PROFIT = '#10b981'; // Green

const getStatusColor = (status: ServiceStatus) => {
  switch (status) {
    case ServiceStatus.COMPLETED: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case ServiceStatus.ONGOING: return 'bg-blue-100 text-blue-800 border-blue-200';
    case ServiceStatus.PENDING: return 'bg-amber-100 text-amber-800 border-amber-200';
    case ServiceStatus.PAUSED: return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

const getStatusLabel = (status: ServiceStatus) => {
  switch (status) {
    case ServiceStatus.COMPLETED: return 'Concluído';
    case ServiceStatus.ONGOING: return 'Em Andamento';
    case ServiceStatus.PENDING: return 'Pendente';
    case ServiceStatus.PAUSED: return 'Pausado';
    case ServiceStatus.CANCELED: return 'Cancelado';
    default: return status;
  }
};

const InitialsAvatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({ name, size = 'md' }) => {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-600`} title={name}>
      {initials}
    </div>
  );
};

interface ServicesProps {
  data: AppState;
  onAddService: (s: Omit<Service, 'id'>) => void;
  onUpdateService: (id: string, updates: Partial<Service>) => void;
  onDeleteService: (id: string) => void;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  visualizationCurrency: string;
  setVisualizationCurrency: (currency: string) => void;
}

export const Services: React.FC<ServicesProps> = ({
  data, onAddService, onUpdateService, onDeleteService,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  visualizationCurrency,
  setVisualizationCurrency,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isNewServiceModalOpen, setIsNewServiceModalOpen] = useState(false);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Chart State
  const [viewGrouping, setViewGrouping] = useState<'DAILY' | 'GROUPED'>('DAILY');
  const [chartType, setChartType] = useState<'BAR' | 'LINE' | 'COMBO' | 'PIE'>('BAR');

  // Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  // Rates
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => { fetchExchangeRates().then(setRates); }, []);

  const convertFromBRL = (amount: number) => {
    if (visualizationCurrency === 'BRL') return amount;
    const rate = rates[visualizationCurrency] || 1;
    return amount / rate;
  };


  // Filter Data Helpers
  const filterServicesByDate = (items: Service[]) => {
    if (dateFilter === 'ALL') return items;

    let from = -Infinity;
    let to = Infinity;

    if (dateFilter === 'CUSTOM') {
      if (!customDates.start && !customDates.end) return items;
      from = customDates.start ? new Date(customDates.start).setHours(0, 0, 0, 0) : -Infinity;
      to = customDates.end ? new Date(customDates.end).setHours(23, 59, 59, 999) : Infinity;
    } else {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const endOfDay = new Date().setHours(23, 59, 59, 999);
      const endOfWeek = new Date(weekStart + 7 * 24 * 60 * 60 * 1000).getTime();
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getTime();

      if (dateFilter === 'TODAY') { from = todayStart; to = endOfDay; }
      if (dateFilter === 'WEEK') { from = weekStart; to = endOfWeek; }
      if (dateFilter === 'MONTH') { from = monthStart; to = endOfMonth; }
    }

    return items.filter(service => {
      const start = new Date(service.startDate).getTime();
      const end = service.endDate ? new Date(service.endDate).getTime() : Infinity;
      // Simple overlap check: Service Start <= Period End AND Service End >= Period Start
      return start <= to && end >= from;
    });
  };

  const filteredServices = filterServicesByDate(data.services);

  // --- CHART DATA PROCESSING (Based on Transactions linked to Services) ---
  const processChartData = () => {
    let start = new Date();
    let end = new Date();
    let granularity: 'day' | 'month' = 'day';

    // 1. Determine Range (Same logic as Dashboard/Offers)
    if (dateFilter === 'TODAY') {
      start = new Date(); end = new Date();
    } else if (dateFilter === 'WEEK') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (dateFilter === 'MONTH') {
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      if (viewGrouping === 'GROUPED') granularity = 'month';
    } else if (dateFilter === 'CUSTOM' && customDates.start && customDates.end) {
      const [sy, sm, sd] = customDates.start.split('-').map(Number);
      const [ey, em, ed] = customDates.end.split('-').map(Number);
      start = new Date(sy, sm - 1, sd);
      end = new Date(ey, em - 1, ed);
      if (viewGrouping === 'GROUPED') granularity = 'month';
    } else if (dateFilter === 'ALL') {
      if (viewGrouping === 'GROUPED') granularity = 'month';
      // Find earliest transaction related to services
      const minDate = data.transactions
        .filter(t => t.serviceId)
        .reduce((min, t) => t.date < min ? t.date : min, new Date().toISOString().split('T')[0]);
      const [y, m, d] = minDate.split('-').map(Number);
      start = new Date(y, m - 1, d);
    }

    // 2. Build Map
    const dataMap = new Map<string, { revenue: number, expense: number, profit: number }>();

    if (granularity === 'day') {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dataMap.set(iso, { revenue: 0, expense: 0, profit: 0 });
      }
    } else {
      let d = new Date(start);
      d.setDate(1);
      while (d <= end) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        dataMap.set(monthKey, { revenue: 0, expense: 0, profit: 0 });
        d.setMonth(d.getMonth() + 1);
      }
    }

    // 3. Aggregate Transactions linked to Services
    data.transactions.forEach(t => {
      if (!t.serviceId) return; // Only look at service transactions

      let key = t.date;
      if (granularity === 'month') {
        key = t.date.substring(0, 7);
      }

      if (dataMap.has(key)) {
        const current = dataMap.get(key)!;
        if (t.type === TransactionType.INCOME) current.revenue += t.amount;
        else current.expense += t.amount;
        current.profit = current.revenue - current.expense;
      }
    });

    // 4. Convert to Array
    return Array.from(dataMap.entries()).sort().map(([key, val]) => {
      let label = key;
      if (granularity === 'day') {
        const [y, m, d] = key.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (dateFilter === 'WEEK') {
          label = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        } else if (dateFilter === 'MONTH') {
          label = String(d);
        } else {
          label = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
        }
      } else {
        const [y, m] = key.split('-').map(Number);
        const dateObj = new Date(y, m - 1, 1);
        label = dateObj.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      }

      return {
        name: label,
        revenue: convertFromBRL(val.revenue),
        expense: convertFromBRL(val.expense),
        profit: convertFromBRL(val.profit)
      };
    });
  };

  const chartData = useMemo(() => processChartData(), [data.transactions, dateFilter, customDates, viewGrouping]);

  const chartTotals = useMemo(() => {
    return chartData.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      expense: acc.expense + curr.expense,
      profit: acc.profit + curr.profit
    }), { revenue: 0, expense: 0, profit: 0 });
  }, [chartData]);

  const pieData = useMemo(() => {
    // Simple Pie: Revenue vs Expense
    const profit = Math.max(0, chartTotals.profit);
    return [
      { name: 'Lucro Líquido', value: profit, color: COL_PROFIT },
      { name: 'Despesas', value: chartTotals.expense, color: COL_EXPENSE }
    ].filter(d => d.value > 0);
  }, [chartTotals]);


  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      onDeleteService(deleteConfirm.id);
      setSelectedServiceId(null);
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  const selectedService = data.services.find(s => s.id === selectedServiceId);

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Excluir Projeto"
        message="Tem certeza que deseja excluir este serviço/projeto? Todos os dados vinculados, incluindo transações e progresso, serão perdidos permanentemente."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Serviços</h1>
          <p className="text-slate-500">Controle operacional e financeiro de projetos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          {/* Currency Selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 h-10">
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

          <button
            onClick={() => setIsNewServiceModalOpen(true)}
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors h-10"
          >
            <Plus size={18} className="mr-2" />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* --- SERVICES CHART SECTION --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Performance Financeira dos Serviços
          </h3>

          <div className="flex flex-col md:flex-row items-center gap-2">
            {(dateFilter === 'MONTH' || dateFilter === 'ALL' || dateFilter === 'CUSTOM') && (
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setViewGrouping('DAILY')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${viewGrouping === 'DAILY' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                  <BarChart2 size={12} /> Diário
                </button>
                <button
                  onClick={() => setViewGrouping('GROUPED')}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${viewGrouping === 'GROUPED' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                  <Layers size={12} /> Mensal
                </button>
              </div>
            )}

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
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase">Receita Realizada (Serviços)</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(chartTotals.revenue, visualizationCurrency)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase">Despesas Vinculadas</p>
            <p className="text-xl font-bold text-rose-600 mt-1">{formatCurrency(chartTotals.expense, visualizationCurrency)}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase">Lucro Operacional</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(chartTotals.profit, visualizationCurrency)}</p>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="flex justify-end">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('BAR')}
              className={`p-1.5 rounded transition-all ${chartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BarChart2 size={16} />
            </button>
            <button
              onClick={() => setChartType('LINE')}
              className={`p-1.5 rounded transition-all ${chartType === 'LINE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <TrendingUp size={16} />
            </button>
            <button
              onClick={() => setChartType('COMBO')}
              className={`p-1.5 rounded transition-all ${chartType === 'COMBO' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Activity size={16} />
            </button>
            <button
              onClick={() => setChartType('PIE')}
              className={`p-1.5 rounded transition-all ${chartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PieChartIcon size={16} />
            </button>
          </div>
        </div>

        {/* Chart Render */}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'BAR' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value / 1000}k`} domain={[0, 'auto']} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value, visualizationCurrency), '']}
                />
                <Bar dataKey="revenue" name="Receita" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                <Bar dataKey="expense" name="Despesa" fill={COL_EXPENSE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
              </BarChart>
            ) : chartType === 'LINE' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value / 1000}k`} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value, visualizationCurrency), '']}
                />
                <Line type="monotone" dataKey="revenue" name="Receita" stroke={COL_REVENUE} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="expense" name="Despesa" stroke={COL_EXPENSE} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="profit" name="Lucro" stroke={COL_PROFIT} strokeWidth={3} dot={false} />
              </LineChart>
            ) : chartType === 'PIE' ? (
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, visualizationCurrency)} />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
              </PieChart>
            ) : (
              // COMBO
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value / 1000}k`} domain={[0, 'auto']} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Bar dataKey="revenue" name="Receita" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                <Bar dataKey="expense" name="Despesa" fill={COL_EXPENSE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                <Line type="monotone" dataKey="profit" name="Lucro" stroke={COL_PROFIT} strokeWidth={3} dot={{ r: 3, fill: COL_PROFIT, strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Services Grid List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredServices.map(service => {
          const progress = service.steps.length > 0
            ? Math.round((service.steps.filter(s => s.isCompleted).length / service.steps.length) * 100)
            : 0;

          // Calculate amount paid from transactions for correct display in list
          const serviceTransactions = data.transactions.filter(t => t.serviceId === service.id && t.type === TransactionType.INCOME);
          const calculatedPaid = serviceTransactions.reduce((acc, t) => acc + t.amount, 0);

          return (
            <div
              key={service.id}
              onClick={() => setSelectedServiceId(service.id)}
              className="group bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all relative"
            >
              {/* Delete Button on Card */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(service.id); }}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors z-10"
                title="Excluir Serviço"
              >
                <Trash2 size={18} className="pointer-events-none" />
              </button>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-10">

                {/* Column 1: Identity */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(service.status)}`}>
                      {getStatusLabel(service.status)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium flex items-center">
                      <Calendar size={12} className="mr-1" />
                      {new Date(service.startDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {service.clientName} <span className="text-slate-400 font-light mx-1">|</span> {service.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-1 mt-1">{service.description || 'Sem descrição definida.'}</p>
                </div>

                {/* Column 2: Participants */}
                <div className="flex items-center -space-x-2 px-2">
                  {service.participants.map(p => {
                    const member = data.members.find(m => m.id === p.memberId);
                    if (!member) return null;
                    return <InitialsAvatar key={p.memberId} name={member.name} size="md" />;
                  })}
                  {service.participants.length === 0 && <span className="text-xs text-slate-400 italic">Sem equipe</span>}
                </div>

                {/* Column 3: Financial & Progress */}
                <div className="flex flex-col items-end min-w-[140px] gap-2">
                  <div className="text-right">
                    <span className="block text-xs text-slate-400 uppercase font-semibold">Valor Total</span>
                    <span className="block font-bold text-slate-900">{formatCurrency(convertFromBRL(service.value), visualizationCurrency)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-slate-400 uppercase font-semibold">Recebido</span>
                    <span className={`block font-bold ${calculatedPaid >= service.value ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {formatCurrency(convertFromBRL(calculatedPaid), visualizationCurrency)}
                    </span>
                  </div>
                  <div className="w-full max-w-[140px] mt-1">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Entregas</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center text-slate-300 group-hover:text-blue-500">
                  <ChevronRight size={24} />
                </div>
              </div>
            </div>
          );
        })}
        {filteredServices.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">Nenhum serviço encontrado neste período.</p>
          </div>
        )}
      </div>

      {/* --- Detail Modal --- */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          data={data}
          onClose={() => setSelectedServiceId(null)}
          onUpdate={(updates) => onUpdateService(selectedService.id, updates)}
          onDelete={() => handleDeleteClick(selectedService.id)}
          onAddTransaction={onAddTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      )}

      {/* --- Create Modal --- */}
      {isNewServiceModalOpen && (
        <CreateServiceModal
          data={data}
          onClose={() => setIsNewServiceModalOpen(false)}
          onSave={onAddService}
        />
      )}
    </div>
  );
};

// --- Sub-Component: Service Detail Modal ---

const ServiceDetailModal = ({
  service,
  data,
  onClose,
  onUpdate,
  onDelete,
  onAddTransaction,
  onDeleteTransaction
}: {
  service: Service,
  data: AppState,
  onClose: () => void,
  onUpdate: (u: Partial<Service>) => void,
  onDelete: () => void,
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void,
  onDeleteTransaction: (id: string) => void
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'team' | 'tasks'>('financial');
  const [showTransactionForm, setShowTransactionForm] = useState<'INCOME' | 'EXPENSE' | null>(null);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDesc, setTransactionDesc] = useState('');

  // BUFFERED STATE: Only save when user clicks "Salvar"
  const [localService, setLocalService] = useState<Service>(service);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync when prop updates (e.g. amountPaid changed by transaction)
  // We need to be careful not to overwrite user edits if they haven't saved.
  // We'll trust the user's edits for text fields, but sync derived fields.
  useEffect(() => {
    // Sync only specific fields that might change externally or calculated
    // Actually, relying on prop updates for concurrent editing is complex.
    // For now, let's just initial load. If amountPaid changes (from transactions), update it.
    setLocalService(prev => ({
      ...prev,
      amountPaid: service.amountPaid
    }));
  }, [service.amountPaid]);

  const updateLocal = (updates: Partial<Service>) => {
    setLocalService(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = () => {
    onUpdate(localService);
    setHasUnsavedChanges(false);
    onClose(); // Optional: close on save, or just feedback. 
    // User requirement: "Close button should only dismiss". Implicitly, Save can stay open or close.
    // Let's close to be safe and clean.
  };

  // Transactions Logic
  const serviceTransactions = data.transactions.filter(t => t.serviceId === service.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalReceived = serviceTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = serviceTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const pendingAmount = localService.value - totalReceived;
  const projectProfit = totalReceived - totalExpenses;

  // Auto-Sync Amount Paid to Service Record for consistency in list view
  // Note: This needs to happen even if modal is open, to keep data consistent.
  // We will trigger onUpdate directly here because it's a system sync, not user edit.
  useEffect(() => {
    if (service.amountPaid !== totalReceived) {
      onUpdate({ amountPaid: totalReceived });
    }
  }, [totalReceived, service.amountPaid, onUpdate]);

  const handleAddStep = (title: string) => {
    const newStep: ServiceStep = { id: Date.now().toString(), title, isCompleted: false };
    updateLocal({ steps: [...localService.steps, newStep] });
  };

  const toggleStep = (stepId: string) => {
    const updatedSteps = localService.steps.map(s =>
      s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s
    );
    updateLocal({ steps: updatedSteps });
  };

  const deleteStep = (stepId: string) => {
    updateLocal({ steps: localService.steps.filter(s => s.id !== stepId) });
  };

  const handleAddParticipant = (memberId: string) => {
    if (localService.participants.find(p => p.memberId === memberId)) return;
    const member = data.members.find(m => m.id === memberId);
    updateLocal({
      participants: [...localService.participants, {
        memberId,
        role: member?.role || 'Colaborador',
        sharePercent: 0
      }]
    });
  };

  const updateParticipant = (memberId: string, field: keyof ServiceParticipant, value: any) => {
    const updated = localService.participants.map(p =>
      p.memberId === memberId ? { ...p, [field]: value } : p
    );
    updateLocal({ participants: updated });
  };

  const removeParticipant = (memberId: string) => {
    updateLocal({ participants: localService.participants.filter(p => p.memberId !== memberId) });
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTransactionForm) return;

    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(transactionAmount),
      description: transactionDesc || (showTransactionForm === 'INCOME' ? `Pagamento: ${localService.clientName}` : `Despesa: ${localService.clientName}`),
      type: showTransactionForm === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: showTransactionForm === 'INCOME' ? 'Venda' : ExpenseCategory.VARIABLE,
      status: TransactionStatus.PAID,
      serviceId: service.id
    });

    setShowTransactionForm(null);
    setTransactionAmount('');
    setTransactionDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <input
                className="bg-transparent text-xs font-bold uppercase tracking-wider text-slate-500 border-none p-0 focus:ring-0 w-full"
                value={localService.clientName}
                onChange={(e) => updateLocal({ clientName: e.target.value })}
              />
            </div>
            <input
              className="text-2xl font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-slate-400"
              value={localService.title}
              onChange={(e) => updateLocal({ title: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={localService.status}
              onChange={(e) => updateLocal({ status: e.target.value as ServiceStatus })}
              className={`text-sm font-semibold py-1.5 px-3 rounded-lg border outline-none cursor-pointer ${localService.status === ServiceStatus.COMPLETED ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                localService.status === ServiceStatus.ONGOING ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}
            >
              <option value={ServiceStatus.PENDING}>Pendente</option>
              <option value={ServiceStatus.ONGOING}>Em Andamento</option>
              <option value={ServiceStatus.PAUSED}>Pausado</option>
              <option value={ServiceStatus.COMPLETED}>Concluído</option>
              <option value={ServiceStatus.CANCELED}>Cancelado</option>
            </select>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {[
            { id: 'financial', label: 'Financeiro', icon: DollarSign },
            { id: 'team', label: 'Participantes & Lucros', icon: Users },
            { id: 'tasks', label: 'Entregas & Etapas', icon: ListTodo },
            { id: 'overview', label: 'Visão Geral', icon: AlertCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição Detalhada do Serviço</label>
                <textarea
                  className="w-full h-32 p-3 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 outline-none resize-none"
                  placeholder="Descreva o escopo, objetivos e detalhes importantes..."
                  value={localService.description}
                  onChange={(e) => updateLocal({ description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Datas</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Início</label>
                      <input
                        type="date"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900"
                        value={localService.startDate.split('T')[0]}
                        onChange={(e) => updateLocal({ startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Previsão de Fim</label>
                      <input
                        type="date"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900"
                        value={localService.endDate ? localService.endDate.split('T')[0] : ''}
                        onChange={(e) => updateLocal({ endDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Resumo de Status</h3>
                  <div className="text-4xl font-bold text-slate-900 mb-1">
                    {localService.steps.length > 0 ? Math.round((localService.steps.filter(s => s.isCompleted).length / localService.steps.length) * 100) : 0}%
                  </div>
                  <p className="text-sm text-slate-500">Concluído</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Financial (REAL LEDGER) */}
          {activeTab === 'financial' && (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-400 uppercase">Valor Contrato</label>
                  <div className="flex items-center mt-2">
                    <span className="text-slate-400 mr-1 text-sm">R$</span>
                    <input
                      type="number"
                      className="text-xl font-bold text-slate-900 bg-transparent border-none p-0 w-full focus:ring-0"
                      value={localService.value}
                      onChange={(e) => updateLocal({ value: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                  <label className="text-xs font-bold text-emerald-600 uppercase">Total Recebido</label>
                  <p className="text-xl font-bold text-emerald-700 mt-2">R$ {totalReceived.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-rose-50 p-5 rounded-xl border border-rose-100 shadow-sm">
                  <label className="text-xs font-bold text-rose-600 uppercase">Despesas Projeto</label>
                  <p className="text-xl font-bold text-rose-700 mt-2">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-400 uppercase">Pendente</label>
                  <p className="text-xl font-bold text-slate-700 mt-2">R$ {pendingAmount.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => { setShowTransactionForm('INCOME'); setTransactionDesc(''); setTransactionAmount(''); }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Registrar Pagamento (Entrada)
                </button>
                <button
                  onClick={() => { setShowTransactionForm('EXPENSE'); setTransactionDesc(''); setTransactionAmount(''); }}
                  className="flex-1 py-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Registrar Despesa (Saída)
                </button>
              </div>

              {/* Transaction Form Inline */}
              {showTransactionForm && (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-800">
                      {showTransactionForm === 'INCOME' ? 'Novo Pagamento Recebido' : 'Nova Despesa do Projeto'}
                    </h4>
                    <button onClick={() => setShowTransactionForm(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                  </div>
                  <form onSubmit={handleSaveTransaction} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                      <input
                        autoFocus
                        type="text"
                        placeholder={showTransactionForm === 'INCOME' ? `Pagamento parcial ${localService.clientName}` : "Ex: Freelancer, Software, Etc"}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none"
                        value={transactionDesc}
                        onChange={e => setTransactionDesc(e.target.value)}
                      />
                    </div>
                    <div className="w-full md:w-48">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none"
                        value={transactionAmount}
                        onChange={e => setTransactionAmount(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className={`px-6 py-2.5 rounded-lg text-white font-medium ${showTransactionForm === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                    >
                      Salvar
                    </button>
                  </form>
                </div>
              )}

              {/* Transaction History Ledger */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h4 className="font-bold text-slate-700">Histórico de Transações</h4>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3">Data</th>
                      <th className="px-6 py-3">Descrição</th>
                      <th className="px-6 py-3 text-right">Valor</th>
                      <th className="px-6 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {serviceTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-900">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td className="px-6 py-3 text-slate-700">{t.description}</td>
                        <td className={`px-6 py-3 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === TransactionType.EXPENSE && '- '}R$ {t.amount.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button onClick={() => onDeleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {serviceTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                          Nenhuma transação registrada para este projeto.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* Tab: Team */}
          {activeTab === 'team' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">Equipe Envolvida</h3>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-700 outline-none"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddParticipant(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Adicionar Membro</option>
                    {data.members
                      .filter(m => !localService.participants.find(p => p.memberId === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Membro</th>
                      <th className="px-6 py-4">Função no Projeto</th>
                      <th className="px-6 py-4 text-right">% Lucro</th>
                      <th className="px-6 py-4 text-right">Previsto (Contrato)</th>
                      <th className="px-6 py-4 text-right">Realizado (Caixa)</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localService.participants.map(p => {
                      const member = data.members.find(m => m.id === p.memberId);
                      if (!member) return null;

                      // Calculate shares based on Contract Value (Estimated) vs Project Profit (Realized)
                      const estimatedShare = (localService.value * p.sharePercent) / 100;
                      const realizedShare = (projectProfit * p.sharePercent) / 100; // Share of Net Profit (Received - Expenses)

                      return (
                        <tr key={p.memberId} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <InitialsAvatar name={member.name} size="sm" />
                              <span className="font-medium text-slate-900">{member.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              className="bg-transparent border-b border-transparent focus:border-slate-300 outline-none text-slate-600 text-sm w-full"
                              value={p.role}
                              onChange={(e) => updateParticipant(p.memberId, 'role', e.target.value)}
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-16 text-right bg-slate-50 border border-slate-200 rounded p-1 text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                                value={p.sharePercent}
                                onChange={(e) => updateParticipant(p.memberId, 'sharePercent', Number(e.target.value))}
                              />
                              <span className="text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-500">
                            R$ {estimatedShare.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600">
                            R$ {realizedShare > 0 ? realizedShare.toLocaleString('pt-BR') : '0,00'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => removeParticipant(p.memberId)}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {localService.participants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                          Nenhum participante adicionado a este serviço ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Total Distribuído</td>
                      <td className="px-6 py-3 text-right font-bold text-slate-900">
                        {localService.participants.reduce((acc, p) => acc + p.sharePercent, 0)}%
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Tasks */}
          {activeTab === 'tasks' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ListTodo className="text-slate-400" />
                  Checklist de Entregas
                </h3>

                <div className="space-y-2 mb-6">
                  {localService.steps.map(step => (
                    <div key={step.id} className="flex items-center group">
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all mr-3 ${step.isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-white border-slate-300 text-transparent hover:border-emerald-400'
                          }`}
                      >
                        <CheckCircle size={14} fill="currentColor" />
                      </button>
                      <span className={`flex-1 text-sm ${step.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {step.title}
                      </span>
                      <button
                        onClick={() => deleteStep(step.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {localService.steps.length === 0 && (
                    <p className="text-slate-400 italic text-sm">Nenhuma etapa definida.</p>
                  )}
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-4">
                  <input
                    type="text"
                    placeholder="+ Adicionar nova etapa..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddStep(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer with Save/Delete */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-rose-500 text-sm font-medium hover:text-rose-700 flex items-center gap-2 px-3 py-2 rounded hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={16} />
            Excluir Projeto
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="text-slate-600 bg-white border border-slate-300 px-6 py-2 rounded-lg font-medium hover:bg-slate-50"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveAll}
              className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 flex items-center gap-2 shadow-sm relative"
            >
              <Save size={18} />
              Salvar Alterações
              {hasUnsavedChanges && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Create Service Modal ---

const CreateServiceModal = ({ data, onClose, onSave }: { data: AppState, onClose: () => void, onSave: (s: Omit<Service, 'id'>) => void }) => {
  const [newService, setNewService] = useState<{
    title: string;
    clientName: string;
    value: string;
    description: string;
    status: ServiceStatus;
    startDate: string;
    endDate: string;
    currency: string;
  }>({
    title: '',
    clientName: '',
    value: '',
    description: '',
    status: ServiceStatus.PENDING,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    currency: 'BRL'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...newService,
      currency: newService.currency,
      value: parseFloat(newService.value) || 0,
      originalAmount: parseFloat(newService.value) || 0, // Set original amount on creation
      amountPaid: 0,
      participants: [],
      steps: []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">Novo Projeto</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título do Projeto</label>
            <input
              required
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Ex: Consultoria de Marketing"
              value={newService.title}
              onChange={e => setNewService({ ...newService, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente</label>
            <input
              required
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Nome do Cliente"
              value={newService.clientName}
              onChange={e => setNewService({ ...newService, clientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Moeda</label>
              <select
                value={newService.currency}
                onChange={e => setNewService({ ...newService, currency: e.target.value })}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Valor do Contrato</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">{newService.currency}</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full pl-12 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                  placeholder="0.00"
                  value={newService.value}
                  onChange={e => setNewService({ ...newService, value: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Início</label>
              <input
                type="date"
                required
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={newService.startDate}
                onChange={e => setNewService({ ...newService, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Previsão Fim</label>
              <input
                type="date"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={newService.endDate}
                onChange={e => setNewService({ ...newService, endDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
            <textarea
              className="w-full h-24 p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Detalhes do escopo..."
              value={newService.description}
              onChange={e => setNewService({ ...newService, description: e.target.value })}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md hover:shadow-lg transform active:scale-95"
            >
              Criar Projeto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
