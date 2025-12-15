
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, ComposedChart, Area
} from 'recharts';
import { AppState, TransactionType, TransactionStatus, OfferStatus, ExpenseCategory } from '../types';
import { TrendingUp, AlertTriangle, Wallet, Users, Calendar, Sparkles, X, Minus, Maximize2, CheckSquare, BarChart2, Layers, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { generateFinancialAnalysis } from '../services/geminiService';
import { DateRangePicker } from './DateRangePicker';
import { Link } from 'react-router-dom';

interface DashboardProps {
  data: AppState;
}

// COLORS - STRICT STYLE GUIDE
const COL_REVENUE = '#3b82f6'; // Blue (Faturamento)
const COL_EXPENSE = '#f43f5e'; // Red (Despesa)
const COL_PROFIT = '#10b981';  // Green (Lucro)
const COL_OTHER = '#94a3b8';   // Slate

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiMinimized, setIsAiMinimized] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  
  // Grouping Toggle: 'DAILY' (show every day) vs 'GROUPED' (monthly aggregation for long periods)
  const [viewGrouping, setViewGrouping] = useState<'DAILY' | 'GROUPED'>('DAILY');

  // Chart Type State
  const [chartType, setChartType] = useState<'BAR' | 'LINE' | 'COMBO' | 'PIE'>('BAR');

  // --- Pending Checks Logic for Banner ---
  const pendingChecksCount = useMemo(() => {
    let count = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    data.offers.forEach(o => {
        if (o.status !== OfferStatus.ACTIVE) return;
        // Check today
        if (todayStr >= o.startDate && (!o.endDate || todayStr <= o.endDate)) {
            if (!o.dailyEntries.find(e => e.date === todayStr)) count++;
        }
        // Check yesterday
        if (yesterdayStr >= o.startDate && (!o.endDate || yesterdayStr <= o.endDate)) {
            if (!o.dailyEntries.find(e => e.date === yesterdayStr)) count++;
        }
    });
    return count;
  }, [data.offers]);

  // --- UNIFIED CHART DATA PROCESSING ---
  // Merges manual Transactions (Services/Overhead) AND Offer Daily Entries (Revenue/Ads)
  const processChartData = () => {
    let start = new Date();
    let end = new Date();
    let granularity: 'day' | 'month' = 'day';

    // 1. Determine Range
    if (dateFilter === 'TODAY') {
        start = new Date(); 
        end = new Date();
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
        // Calculate min date from both sources
        let minT = data.transactions.reduce((min, t) => t.date < min ? t.date : min, new Date().toISOString().split('T')[0]);
        let minO = minT;
        data.offers.forEach(o => o.dailyEntries.forEach(e => { if(e.date < minO) minO = e.date }));
        
        const [y, m, d] = (minO < minT ? minO : minT).split('-').map(Number);
        start = new Date(y, m - 1, d);
    }

    // 2. Generate Timeline Map
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

    // 3. Merge Source A: Transactions
    data.transactions.forEach(t => {
        let key = t.date;
        if (granularity === 'month') key = t.date.substring(0, 7);

        if (dataMap.has(key)) {
            const current = dataMap.get(key)!;
            if (t.type === TransactionType.INCOME) current.revenue += t.amount;
            else current.expense += t.amount;
            current.profit = current.revenue - current.expense;
        }
    });

    // 4. Merge Source B: Offer Daily Entries
    data.offers.forEach(offer => {
        offer.dailyEntries.forEach(entry => {
            let key = entry.date;
            if (granularity === 'month') key = entry.date.substring(0, 7);
            
            if (dataMap.has(key)) {
                const current = dataMap.get(key)!;
                current.revenue += entry.revenue;
                current.expense += entry.adsSpend;
                current.profit = current.revenue - current.expense;
            }
        });
    });

    // 5. Convert to Array
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
            faturamento: val.revenue,
            despesa: val.expense,
            lucro: val.profit
        };
    });
  };

  const chartData = useMemo(() => processChartData(), [data.transactions, data.offers, dateFilter, customDates, viewGrouping]);

  // Calculations for Totals (Aggregated)
  const aggregatedTotals = useMemo(() => {
     return chartData.reduce((acc, curr) => ({
        revenue: acc.revenue + curr.faturamento,
        expense: acc.expense + curr.despesa,
        profit: acc.profit + curr.lucro
     }), { revenue: 0, expense: 0, profit: 0 });
  }, [chartData]);

  const totalRevenue = aggregatedTotals.revenue;
  const netProfit = aggregatedTotals.profit;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Pending Income (Transactions only, Offers are usually settled daily)
  const pendingIncome = data.transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
    .reduce((acc, t) => acc + t.amount, 0);

  // --- Pie Chart Logic (Aggregated) ---
  const pieData = useMemo(() => {
     // Breakdown: Marketing (Ads from offers + Manual Ads), Other Expenses, Profit
     // 1. Calculate total ads from offers
     const offerAds = data.offers.reduce((sum, o) => sum + o.dailyEntries.reduce((s, e) => s + e.adsSpend, 0), 0);
     // 2. Calculate manual ads
     const manualAds = data.transactions
        .filter(t => t.type === TransactionType.EXPENSE && t.category === ExpenseCategory.MARKETING)
        .reduce((sum, t) => sum + t.amount, 0);
     
     const totalAds = offerAds + manualAds;
     const otherExpenses = aggregatedTotals.expense - totalAds;
     const profitSlice = Math.max(0, netProfit);
     
     return [
        { name: 'Lucro Líquido', value: profitSlice, color: COL_PROFIT },
        { name: 'Ads / Marketing', value: totalAds, color: COL_EXPENSE },
        { name: 'Outras Despesas', value: otherExpenses, color: '#f59e0b' } // Amber for others
     ].filter(d => d.value > 0);
  }, [aggregatedTotals, data.transactions, data.offers, netProfit]);


  const handleAiAnalysis = async () => {
    setIsLoadingAi(true);
    setAiAnalysis(null);
    setIsAiMinimized(false);
    // Prepare condensed data for AI
    const analysisData = {
        totalRevenue,
        totalExpense: aggregatedTotals.expense,
        netProfit,
        margin,
        servicesCount: data.services.length,
        offersCount: data.offers.length,
        pendingIncome
    };
    const result = await generateFinancialAnalysis({ ...data, transactions: [] }); // Sending full state might be too big, but let's try or simplified
    setAiAnalysis(result);
    setIsLoadingAi(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Pending Check Banner */}
      {pendingChecksCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-full">
                      <CheckSquare className="text-amber-600" size={20} />
                  </div>
                  <div>
                      <h4 className="font-bold text-amber-900">Atenção Necessária</h4>
                      <p className="text-sm text-amber-700">
                          Você possui <span className="font-bold">{pendingChecksCount} registros pendentes</span> na checagem diária (Hoje/Ontem).
                      </p>
                  </div>
              </div>
              <Link to="/checagem" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                  Resolver Agora
              </Link>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumo Geral (Consolidado)</h1>
          <p className="text-slate-500">Unificação de Ofertas + Serviços + Fluxo de Caixa</p>
        </div>

        <div className="flex flex-col items-end gap-2 relative">
            <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            {['TODAY', 'WEEK', 'MONTH', 'ALL'].map((f) => (
                <button
                    key={f}
                    type="button"
                    onClick={() => {
                        setDateFilter(f as any);
                        setShowCustomPicker(false);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    dateFilter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    {f === 'TODAY' ? 'Hoje' : f === 'WEEK' ? 'Semana' : f === 'MONTH' ? 'Mês' : 'Tudo'}
                </button>
            ))}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowCustomPicker(!showCustomPicker);
                }}
                className={`px-3 py-1 rounded transition-colors flex items-center justify-center ${
                    showCustomPicker ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
                title="Período Personalizado"
            >
                <Calendar size={14} />
            </button>
            </div>

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

      <div className="flex justify-end">
        <button 
          onClick={handleAiAnalysis}
          disabled={isLoadingAi}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Sparkles size={16} />
          {isLoadingAi ? 'Analisando...' : 'IA: Gerar Relatório'}
        </button>
      </div>

      {/* AI Insight Box */}
      {aiAnalysis && (
        <div className={`bg-white border border-indigo-100 rounded-xl shadow-sm relative ring-1 ring-indigo-50 transition-all duration-300 ${isAiMinimized ? 'p-3' : 'p-6'}`}>
          <div className="flex justify-between items-start mb-2">
             <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-500" />
                Análise Inteligente
            </h3>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setIsAiMinimized(!isAiMinimized)}
                    className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-full transition-all"
                    title={isAiMinimized ? "Expandir Relatório" : "Minimizar Relatório"}
                    type="button"
                >
                   {isAiMinimized ? <Maximize2 size={18} /> : <Minus size={18} />}
                </button>
                <button
                    onClick={() => { setAiAnalysis(null); setIsAiMinimized(false); }}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-all"
                    title="Fechar Relatório"
                    type="button"
                >
                    <X size={18} />
                </button>
            </div>
          </div>
          
          {!isAiMinimized && (
            <div className="prose prose-indigo prose-sm text-slate-700 whitespace-pre-line max-w-none animate-fade-in mt-4 border-t border-indigo-50 pt-4">
                {aiAnalysis}
            </div>
          )}
          {isAiMinimized && (
            <p className="text-xs text-slate-400 mt-1 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => setIsAiMinimized(false)}>
                Relatório minimizado. Clique para expandir.
            </p>
          )}
        </div>
      )}

      {/* KPI Cards (CONSOLIDATED) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento - BLUE */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Faturamento Global</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">R$ {totalRevenue.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">Serviços + Ofertas + Outros</p>
        </div>

        {/* Lucro - GREEN */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Lucro Líquido</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">R$ {netProfit.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Wallet size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Margem atual: <span className="font-bold text-slate-700">{margin.toFixed(1)}%</span></p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">A Receber (Pendente)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">R$ {pendingIncome.toLocaleString('pt-BR')}</h3>
            </div>
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-2 font-medium">Transações manuais em aberto</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Projetos Ativos</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{data.services.length + data.offers.length}</h3>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Users size={20} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {data.services.filter(s => s.status === 'ONGOING').length} Serviços + {data.offers.filter(o => o.status === OfferStatus.ACTIVE).length} Ofertas
          </p>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div className="flex items-center gap-4">
                 <h3 className="text-lg font-semibold text-slate-800">
                     Performance Financeira Consolidada
                 </h3>
                 {/* Grouping Toggle */}
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
             </div>
             
             {/* Chart Type Switcher */}
             <div className="flex bg-slate-100 rounded-lg p-1">
                <button 
                  onClick={() => setChartType('BAR')}
                  className={`p-1.5 rounded transition-all ${chartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Gráfico de Barras"
                >
                  <BarChart2 size={16} />
                </button>
                <button 
                  onClick={() => setChartType('LINE')}
                  className={`p-1.5 rounded transition-all ${chartType === 'LINE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Gráfico de Linhas"
                >
                  <TrendingUp size={16} />
                </button>
                <button 
                  onClick={() => setChartType('COMBO')}
                  className={`p-1.5 rounded transition-all ${chartType === 'COMBO' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Combinado"
                >
                  <Activity size={16} />
                </button>
                <button 
                  onClick={() => setChartType('PIE')}
                  className={`p-1.5 rounded transition-all ${chartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  title="Distribuição (Pizza)"
                >
                  <PieChartIcon size={16} />
                </button>
             </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {/* RENDER BASED ON CHART TYPE */}
              {chartType === 'BAR' ? (
                <BarChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                   <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                   />
                   <Bar dataKey="faturamento" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                   <Bar dataKey="despesa" name="Despesa" fill={COL_EXPENSE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                </BarChart>
              ) : chartType === 'LINE' ? (
                <LineChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                   <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                   />
                   <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke={COL_REVENUE} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                   <Line type="monotone" dataKey="despesa" name="Despesa" stroke={COL_EXPENSE} strokeWidth={3} dot={false} />
                   <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={false} />
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
                   <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                   <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
              ) : (
                // COMBO (Default/Old Composed)
                <ComposedChart data={chartData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                   <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                   />
                   <Bar dataKey="faturamento" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                   <Bar dataKey="despesa" name="Despesa" fill={COL_EXPENSE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                   <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={{ r: 3, fill: COL_PROFIT, strokeWidth: 2, stroke: '#fff' }} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
