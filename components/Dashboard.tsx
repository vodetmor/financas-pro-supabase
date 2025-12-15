import React, { useState, useEffect } from 'react';
import { AppState, TransactionType, TransactionStatus, OfferStatus, PayoutModel } from '../types';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Briefcase,
  Calendar, ArrowRight, Activity, Percent
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRangePicker } from './DateRangePicker';
import { CURRENCIES, convertToBRL, fetchExchangeRates, formatCurrency } from '../services/currency';

interface DashboardProps {
  data: AppState;
  visualizationCurrency: string;
  setVisualizationCurrency: (currency: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  visualizationCurrency,
  setVisualizationCurrency
}) => {
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchExchangeRates().then(setRates);
  }, []);

  // --- Helpers ---
  // If visualizationCurrency is BRL, used conversion 1. 
  // If USD, we need BRL -> USD. 
  // Our rates map is Foreign -> BRL (e.g. USD: 6.0).
  // So to convert BRL to Foreign, we divide by rate.
  const convertFromBRL = (amountBRL: number) => {
    if (visualizationCurrency === 'BRL') return amountBRL;
    const rate = rates[visualizationCurrency] || 1;
    // Rate is "How many BRL is 1 Foreign". 
    // So 6 BRL = 1 USD.
    // 12 BRL = 2 USD.
    // So BRL / Rate = Foreign.
    return amountBRL / rate;
  };

  const getFilteredData = () => {
    const now = new Date();
    // Reset hours for accurate comparison
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let start = 0;
    let end = 0;

    if (dateFilter === 'TODAY') {
      start = startOfDay;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    } else if (dateFilter === 'WEEK') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      start = weekStart.getTime();

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      end = weekEnd.getTime();
    } else if (dateFilter === 'MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(23, 59, 59, 999);
    } else if (dateFilter === 'CUSTOM' && customDates.start && customDates.end) {
      start = new Date(customDates.start + 'T00:00:00').getTime();
      end = new Date(customDates.end + 'T23:59:59').getTime();
    } else {
      // ALL
      start = 0;
      end = 32503680000000; // Year 3000
    }

    const txs = data.transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00').getTime();
      return d >= start && d <= end;
    });

    // For offers, we filter daily entries
    const entries = data.offers.flatMap(o => o.dailyEntries).filter(e => {
      const d = new Date(e.date + 'T00:00:00').getTime();
      return d >= start && d <= end;
    });

    return { txs, entries };
  };

  const { txs, entries } = getFilteredData();

  // --- Calculations (BRL Base) ---
  const income = txs.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const expense = txs.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);

  // Offer Stats (Revenue vs Profit)
  const offerRevenue = entries.reduce((acc, e) => acc + e.revenue, 0);
  const offerAds = entries.reduce((acc, e) => acc + e.adsSpend, 0);
  const offerProfit = entries.reduce((acc, e) => acc + e.netProfit, 0);
  const teamShare = entries.reduce((acc, e) => acc + e.teamShare, 0);
  const companyShare = offerProfit - teamShare;

  // Combined (Offers are separate? Or included in Transactions? 
  // In this system, "Offers" logic is usually separate for tracking, 
  // but actual payouts/receipts might be in transactions.
  // For "General Summary", we usually sum everything.
  // Assuming Transactions include "Other" income/expenses + Offer Payouts if manually entered.
  // But purely for "Dashboard", let's show the aggregation of the "Offer/Operation" side vs "Cash Flow" side.
  // Let's stick to the requested "General Summary" which likely shows High Level KPIs.

  // Update: User asked to switch visualization currency.
  // We calculate everything in BRL then convert at the end.

  const displayIncome = convertFromBRL(income);
  const displayExpense = convertFromBRL(expense);
  const displayBalance = displayIncome - displayExpense;

  const displayOfferRevenue = convertFromBRL(offerRevenue);
  const displayOfferProfit = convertFromBRL(offerProfit);
  const displayTeamShare = convertFromBRL(teamShare);
  const displayCompanyShare = convertFromBRL(companyShare);


  // --- Chart Data ---
  // Group by date
  const chartMap = new Map<string, { date: string, income: number, expense: number }>();
  // Init with range? For simplicity, just data points.
  txs.forEach(t => {
    const existing = chartMap.get(t.date) || { date: t.date, income: 0, expense: 0 };
    if (t.type === TransactionType.INCOME) existing.income += t.amount;
    else existing.expense += t.amount;
    chartMap.set(t.date, existing);
  });
  const chartData = Array.from(chartMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      income: convertFromBRL(d.income),
      expense: convertFromBRL(d.expense)
    }));


  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
          <p className="text-slate-500">Resumo financeiro e performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
            <DollarSign size={16} className="text-slate-400" />
            <select
              value={visualizationCurrency}
              onChange={(e) => setVisualizationCurrency(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
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
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Briefcase size={24} /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resultado Líquido</span>
          </div>
          <h3 className={`text-2xl font-bold ${displayCompanyShare >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(displayCompanyShare, visualizationCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Lucro da Operação (Share da Empresa)</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600"><TrendingUp size={24} /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento (Ofertas)</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            {formatCurrency(displayOfferRevenue, visualizationCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Soma das vendas brutas</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-purple-100 p-3 rounded-lg text-purple-600"><Users size={24} /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repasse Equipe</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            {formatCurrency(displayTeamShare, visualizationCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Comissões e participações</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${displayBalance >= 0 ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-600'}`}>
              <Activity size={24} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fluxo de Caixa</span>
          </div>
          <h3 className={`text-2xl font-bold ${displayBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(displayBalance, visualizationCurrency)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Receitas - Despesas (Geral)</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Fluxo de Caixa ({visualizationCurrency})</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => formatCurrency(val, visualizationCurrency)}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                />
                <Area type="monotone" dataKey="income" name="Entradas" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" name="Saídas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Resumo Operacional</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Margem de Lucro</span>
                <span className="font-bold text-slate-900">
                  {offerRevenue > 0 ? ((offerProfit / offerRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${offerRevenue > 0 ? Math.min((offerProfit / offerRevenue) * 100, 100) : 0}%` }}></div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Receita Bruta</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(displayOfferRevenue, visualizationCurrency)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Investimento (Ads)</span>
                <span className="text-sm font-medium text-rose-600">-{formatCurrency(convertFromBRL(offerAds), visualizationCurrency)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <span className="text-sm font-bold text-slate-700">Lucro Bruto</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(displayOfferProfit, visualizationCurrency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
