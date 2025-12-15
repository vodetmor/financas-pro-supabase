
import React, { useState, useMemo, useEffect } from 'react';
import { Offer, AppState, OfferStatus, PayoutModel, DailyEntry, OfferParticipant } from '../types';
import { 
  Plus, Trash2, Calendar, ChevronRight, X, Target, 
  DollarSign, Users, TrendingUp, AlertCircle, BarChart3, Receipt, Activity, BarChart2, Layers, PieChart as PieChartIcon, CheckCircle, Save
} from 'lucide-react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, PieChart, Pie, Cell, Legend, BarChart, LineChart
} from 'recharts';
import { ConfirmModal } from './ConfirmModal';
import { DateRangePicker } from './DateRangePicker';

// COLORS - STRICT STYLE GUIDE
const COL_REVENUE = '#3b82f6'; // Blue
const COL_ADS = '#f43f5e'; // Red (Expense)
const COL_PROFIT = '#10b981'; // Green
const COL_COMMISSION = '#6366f1'; // Indigo

// Helper for Initials
const InitialsAvatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const sizeClasses = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-600`} title={name}>
      {initials}
    </div>
  );
};

// Helper for Offer Status Styles
const getOfferStatusStyles = (status: OfferStatus) => {
  switch(status) {
    case OfferStatus.ACTIVE:
      return {
        wrapper: 'bg-emerald-100 text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-700',
        label: 'Ativa',
        select: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    case OfferStatus.PAUSED:
      return {
        wrapper: 'bg-amber-100 text-amber-600',
        badge: 'bg-amber-100 text-amber-700',
        label: 'Pausada',
        select: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    default:
       return {
        wrapper: 'bg-slate-100 text-slate-500',
        badge: 'bg-slate-100 text-slate-500',
        label: 'Finalizada',
        select: 'bg-slate-100 text-slate-700 border-slate-200'
      };
  }
};

interface OffersProps {
  data: AppState;
  onAddOffer: (o: Omit<Offer, 'id'>) => void;
  onUpdateOffer: (id: string, updates: Partial<Offer>) => void;
  onDeleteOffer: (id: string) => void;
}

export const Offers: React.FC<OffersProps> = ({ data, onAddOffer, onUpdateOffer, onDeleteOffer }) => {
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [isNewOfferModalOpen, setIsNewOfferModalOpen] = useState(false);
  
  // Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  // --- GLOBAL CHART STATE ---
  const [globalDateFilter, setGlobalDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [globalCustomDates, setGlobalCustomDates] = useState({ start: '', end: '' });
  const [showGlobalCustomPicker, setShowGlobalCustomPicker] = useState(false);
  const [globalViewGrouping, setGlobalViewGrouping] = useState<'DAILY' | 'GROUPED'>('DAILY');
  const [globalChartType, setGlobalChartType] = useState<'BAR' | 'LINE' | 'COMBO' | 'PIE'>('BAR');

  const selectedOffer = data.offers.find(o => o.id === selectedOfferId);

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      onDeleteOffer(deleteConfirm.id);
      setSelectedOfferId(null);
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  // Logic to calculate summary metrics for grid cards
  const getOfferMetrics = (offer: Offer) => {
    const revenue = offer.dailyEntries.reduce((sum, e) => sum + e.revenue, 0);
    const ads = offer.dailyEntries.reduce((sum, e) => sum + e.adsSpend, 0);
    const profit = revenue - ads;
    const roi = ads > 0 ? (profit / ads) * 100 : 0;
    return { revenue, ads, profit, roi };
  };

  // --- GLOBAL CHART DATA PROCESSING ---
  const processGlobalChartData = () => {
    let start = new Date();
    let end = new Date();
    let granularity: 'day' | 'month' = 'day';

    // 1. Determine Range
    if (globalDateFilter === 'TODAY') {
        start = new Date(); 
        end = new Date();
    } else if (globalDateFilter === 'WEEK') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (globalDateFilter === 'MONTH') {
        start.setDate(1);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        if (globalViewGrouping === 'GROUPED') granularity = 'month';
    } else if (globalDateFilter === 'CUSTOM' && globalCustomDates.start && globalCustomDates.end) {
        const [sy, sm, sd] = globalCustomDates.start.split('-').map(Number);
        const [ey, em, ed] = globalCustomDates.end.split('-').map(Number);
        start = new Date(sy, sm - 1, sd);
        end = new Date(ey, em - 1, ed);
        if (globalViewGrouping === 'GROUPED') granularity = 'month';
    } else if (globalDateFilter === 'ALL') {
        if (globalViewGrouping === 'GROUPED') granularity = 'month';
        let minDateStr = new Date().toISOString().split('T')[0];
        data.offers.forEach(o => {
            o.dailyEntries.forEach(e => {
                if (e.date < minDateStr) minDateStr = e.date;
            });
        });
        const [y, m, d] = minDateStr.split('-').map(Number);
        start = new Date(y, m - 1, d);
    }

    // 2. Build Map for Aggregation
    const dataMap = new Map<string, { revenue: number, ads: number, profit: number, commission: number }>();
    
    // Initialize map
    if (granularity === 'day') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
             const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
             dataMap.set(iso, { revenue: 0, ads: 0, profit: 0, commission: 0 });
        }
    } else {
        let d = new Date(start);
        d.setDate(1);
        while (d <= end) {
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            dataMap.set(monthKey, { revenue: 0, ads: 0, profit: 0, commission: 0 });
            d.setMonth(d.getMonth() + 1);
        }
    }

    // 3. Aggregate Data from ALL Offers
    data.offers.forEach(offer => {
        // We include all entries regardless of status because they are historical records
        offer.dailyEntries.forEach(entry => {
            let key = entry.date;
            if (granularity === 'month') {
                key = entry.date.substring(0, 7);
            }
            
            if (dataMap.has(key)) {
                const current = dataMap.get(key)!;
                current.revenue += entry.revenue;
                current.ads += entry.adsSpend;
                current.profit += entry.netProfit;
                
                // DYNAMIC COMMISSION CALCULATION (Fix for user request)
                // Do not use entry.teamShare (stale). Recalculate based on current offer rules.
                const base = offer.payoutModel === PayoutModel.REVENUE ? entry.revenue : entry.netProfit;
                const dynamicCommission = (base * (offer.teamPotPercent || 0)) / 100;
                
                current.commission += dynamicCommission;
            }
        });
    });

    // 4. Convert to Array
    return Array.from(dataMap.entries()).sort().map(([key, val]) => {
        let label = key;
        if (granularity === 'day') {
             const [y, m, d] = key.split('-').map(Number);
             const dateObj = new Date(y, m - 1, d);
             if (globalDateFilter === 'WEEK') {
                 label = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                 label = label.charAt(0).toUpperCase() + label.slice(1);
             } else if (globalDateFilter === 'MONTH') {
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
            ...val
        };
    });
  };

  const globalChartData = useMemo(() => processGlobalChartData(), [data.offers, globalDateFilter, globalCustomDates, globalViewGrouping]);

  const globalFilteredTotals = useMemo(() => {
     return globalChartData.reduce((acc, curr) => ({
        revenue: acc.revenue + curr.revenue,
        ads: acc.ads + curr.ads,
        profit: acc.profit + curr.profit,
        commission: acc.commission + curr.commission
     }), { revenue: 0, ads: 0, profit: 0, commission: 0 });
  }, [globalChartData]);

  const globalPieData = useMemo(() => {
     const realProfit = globalFilteredTotals.revenue - globalFilteredTotals.ads - globalFilteredTotals.commission;
     return [
        { name: 'Lucro Real Empresa', value: Math.max(0, realProfit), color: COL_PROFIT },
        { name: 'Investimento Ads', value: globalFilteredTotals.ads, color: COL_ADS },
        { name: 'Comissão Equipe', value: globalFilteredTotals.commission, color: COL_COMMISSION }
     ].filter(d => d.value > 0);
  }, [globalFilteredTotals]);


  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Excluir Oferta"
        message="Tem certeza que deseja excluir esta oferta? Todo o histórico de faturamento diário será perdido."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Ofertas</h1>
          <p className="text-slate-500">Rastreamento diário de performance e comissões</p>
        </div>

        <button 
          onClick={() => setIsNewOfferModalOpen(true)}
          className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors h-10"
        >
          <Plus size={18} className="mr-2" />
          Nova Oferta
        </button>
      </div>

      {/* --- GLOBAL OFFERS CHART SECTION --- */}
      {data.offers.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="text-blue-600" />
                        Performance Financeira Global (Todas as Ofertas)
                    </h3>

                    <div className="flex flex-col md:flex-row items-center gap-2">
                        {/* Grouping */}
                         {(globalDateFilter === 'MONTH' || globalDateFilter === 'ALL' || globalDateFilter === 'CUSTOM') && (
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button 
                                onClick={() => setGlobalViewGrouping('DAILY')}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${globalViewGrouping === 'DAILY' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                >
                                    <BarChart2 size={12} /> Diário
                                </button>
                                <button 
                                onClick={() => setGlobalViewGrouping('GROUPED')}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${globalViewGrouping === 'GROUPED' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                >
                                    <Layers size={12} /> Mensal
                                </button>
                            </div>
                         )}

                         {/* Date Filter */}
                         <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 relative">
                            {['TODAY', 'WEEK', 'MONTH', 'ALL'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => {
                                        setGlobalDateFilter(f as any);
                                        setShowGlobalCustomPicker(false);
                                    }}
                                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                                    globalDateFilter === f ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {f === 'TODAY' ? 'Hoje' : f === 'WEEK' ? 'Semana' : f === 'MONTH' ? 'Mês' : 'Tudo'}
                                </button>
                            ))}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowGlobalCustomPicker(!showGlobalCustomPicker);
                                }}
                                className={`px-3 py-1 rounded transition-colors flex items-center justify-center ${
                                    showGlobalCustomPicker ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'
                                }`}
                                title="Período Personalizado"
                            >
                                <Calendar size={14} />
                            </button>
                            {showGlobalCustomPicker && (
                                <DateRangePicker 
                                startDate={globalCustomDates.start}
                                endDate={globalCustomDates.end}
                                onChange={(start, end) => {
                                    setGlobalCustomDates({ start, end });
                                }}
                                onClose={() => setShowGlobalCustomPicker(false)}
                                onApply={() => { setShowGlobalCustomPicker(false); setGlobalDateFilter('CUSTOM'); }}
                                />
                            )}
                         </div>
                    </div>
               </div>

               {/* KPI Cards */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Faturamento Total</p>
                        <p className="text-xl font-bold text-blue-600 mt-1">R$ {globalFilteredTotals.revenue.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Despesa Total (Ads)</p>
                        <p className="text-xl font-bold text-rose-600 mt-1">R$ {globalFilteredTotals.ads.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Lucro Líquido (Ofertas)</p>
                        <p className="text-xl font-bold text-emerald-600 mt-1">R$ {globalFilteredTotals.profit.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Comissão Equipe</p>
                        <p className="text-xl font-bold text-indigo-600 mt-1">R$ {globalFilteredTotals.commission.toLocaleString('pt-BR')}</p>
                    </div>
               </div>

               {/* Chart Switcher */}
               <div className="flex justify-end">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button 
                        onClick={() => setGlobalChartType('BAR')}
                        className={`p-1.5 rounded transition-all ${globalChartType === 'BAR' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Gráfico de Barras"
                        >
                        <BarChart2 size={16} />
                        </button>
                        <button 
                        onClick={() => setGlobalChartType('LINE')}
                        className={`p-1.5 rounded transition-all ${globalChartType === 'LINE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Gráfico de Linhas"
                        >
                        <TrendingUp size={16} />
                        </button>
                        <button 
                        onClick={() => setGlobalChartType('COMBO')}
                        className={`p-1.5 rounded transition-all ${globalChartType === 'COMBO' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Combinado"
                        >
                        <Activity size={16} />
                        </button>
                        <button 
                        onClick={() => setGlobalChartType('PIE')}
                        className={`p-1.5 rounded transition-all ${globalChartType === 'PIE' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Distribuição (Pizza)"
                        >
                        <PieChartIcon size={16} />
                        </button>
                    </div>
               </div>

               {/* Chart Render */}
               <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                         {globalChartType === 'BAR' ? (
                            <BarChart data={globalChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                                <Tooltip 
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                                />
                                <Bar dataKey="revenue" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                <Bar dataKey="ads" name="Despesa (Ads)" fill={COL_ADS} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                            </BarChart>
                         ) : globalChartType === 'LINE' ? (
                            <LineChart data={globalChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                                />
                                <Line type="monotone" dataKey="revenue" name="Faturamento" stroke={COL_REVENUE} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="ads" name="Despesa (Ads)" stroke={COL_ADS} strokeWidth={3} dot={false} />
                                <Line type="monotone" dataKey="profit" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={false} />
                            </LineChart>
                         ) : globalChartType === 'PIE' ? (
                            <PieChart>
                                <Pie
                                    data={globalPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={4}
                                    dataKey="value"
                                    >
                                    {globalPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                         ) : (
                            // COMBO
                            <ComposedChart data={globalChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#64748b', fontSize: 12}} 
                                    interval="preserveStartEnd"
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                                <Tooltip 
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                />
                                <Bar dataKey="revenue" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                <Bar dataKey="ads" name="Despesa (Ads)" fill={COL_ADS} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                <Line type="monotone" dataKey="profit" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={{ r: 3, fill: COL_PROFIT, strokeWidth: 2, stroke: '#fff' }} />
                            </ComposedChart>
                         )}
                    </ResponsiveContainer>
               </div>
          </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.offers.map(offer => {
          const metrics = getOfferMetrics(offer);
          const statusStyles = getOfferStatusStyles(offer.status);

          return (
            <div 
              key={offer.id}
              onClick={() => setSelectedOfferId(offer.id)}
              className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all relative"
            >
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(offer.id); }}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors z-10"
                title="Excluir Oferta"
              >
                <Trash2 size={18} className="pointer-events-none" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                 <div className={`p-2 rounded-lg ${statusStyles.wrapper}`}>
                    <Target size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{offer.name}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusStyles.badge}`}>
                       {statusStyles.label}
                    </span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mb-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Faturamento</span>
                    <span className="font-bold text-blue-600 text-lg">R$ {metrics.revenue.toLocaleString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Lucro Líquido</span>
                    <span className={`font-bold text-lg ${metrics.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {metrics.profit.toLocaleString('pt-BR')}
                    </span>
                  </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500">
                 <div className="flex items-center gap-1">
                    <Users size={14} />
                    <span>{offer.participants.length} membros</span>
                 </div>
                 <div className="flex items-center gap-1 text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Detalhes <ChevronRight size={14} />
                 </div>
              </div>
            </div>
          );
        })}
        {data.offers.length === 0 && (
           <div className="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
              <Target className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="text-slate-500 mb-2">Nenhuma oferta cadastrada.</p>
              <button onClick={() => setIsNewOfferModalOpen(true)} className="text-blue-600 hover:underline font-medium">
                Criar a primeira oferta
              </button>
           </div>
        )}
      </div>

      {/* --- Detail Modal --- */}
      {selectedOffer && (
        <OfferDetailModal 
          offer={selectedOffer} 
          data={data}
          onClose={() => setSelectedOfferId(null)}
          onUpdate={(updates) => onUpdateOffer(selectedOffer.id, updates)}
          onDelete={() => handleDeleteClick(selectedOffer.id)}
        />
      )}

      {/* --- Create Modal --- */}
      {isNewOfferModalOpen && (
        <CreateOfferModal 
          onClose={() => setIsNewOfferModalOpen(false)}
          onSave={onAddOffer}
        />
      )}
    </div>
  );
};

// --- Sub-Component: Offer Detail Modal ---

const OfferDetailModal = ({ offer, data, onClose, onUpdate, onDelete }: { offer: Offer, data: AppState, onClose: () => void, onUpdate: (u: Partial<Offer>) => void, onDelete: () => void }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'team' | 'daily' | 'history'>('daily');
  const statusStyles = getOfferStatusStyles(offer.status);

  // BUFFERED STATE: Only save when user clicks "Salvar"
  const [localOffer, setLocalOffer] = useState<Offer>(offer);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync on mount or if external offer ID changes (to avoid stale state on switch)
  useEffect(() => {
      setLocalOffer(offer);
      setHasUnsavedChanges(false);
  }, [offer.id]); // Careful: Only reset on ID change, not on every prop update, to preserve edits.

  const updateLocal = (updates: Partial<Offer>) => {
      setLocalOffer(prev => ({ ...prev, ...updates }));
      setHasUnsavedChanges(true);
  };

  const handleSaveAll = () => {
      onUpdate(localOffer);
      setHasUnsavedChanges(false);
      onClose(); // Explicitly close on save
  };

  // --- Analytics Filter State ---
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [viewGrouping, setViewGrouping] = useState<'DAILY' | 'GROUPED'>('DAILY');
  
  // --- Chart Type State ---
  const [chartType, setChartType] = useState<'BAR' | 'LINE' | 'COMBO' | 'PIE'>('BAR');

  // --- Daily Entry State ---
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryRevenue, setEntryRevenue] = useState('');
  const [entryAds, setEntryAds] = useState('');

  // Handle Adding Daily Entry (Locally)
  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const revenue = parseFloat(entryRevenue) || 0;
    const ads = parseFloat(entryAds) || 0;
    const netProfit = revenue - ads;
    
    // HIERARCHICAL CALCULATION LOGIC:
    // 1. Calculate Total Team Pot based on Global %
    let baseAmount = localOffer.payoutModel === PayoutModel.REVENUE ? revenue : netProfit;
    const teamShare = (baseAmount * (localOffer.teamPotPercent || 0)) / 100;

    const newEntry: DailyEntry = {
      id: Date.now().toString(),
      date: entryDate,
      revenue,
      adsSpend: ads,
      netProfit,
      teamShare
    };

    updateLocal({ dailyEntries: [newEntry, ...localOffer.dailyEntries] });
    
    // Reset form
    setEntryRevenue('');
    setEntryAds('');
  };

  const deleteEntry = (entryId: string) => {
    updateLocal({ dailyEntries: localOffer.dailyEntries.filter(e => e.id !== entryId) });
  };

  // --- Team Management ---
  const handleAddParticipant = (memberId: string) => {
    if (localOffer.participants.find(p => p.memberId === memberId)) return;
    const member = data.members.find(m => m.id === memberId);
    updateLocal({ 
      participants: [...localOffer.participants, { 
        memberId, 
        role: member?.role || 'Colaborador', 
        sharePercent: 0 
      }] 
    });
  };

  const updateParticipant = (memberId: string, field: keyof OfferParticipant, value: any) => {
    const updated = localOffer.participants.map(p => 
      p.memberId === memberId ? { ...p, [field]: value } : p
    );
    updateLocal({ participants: updated });
  };

  const removeParticipant = (memberId: string) => {
    updateLocal({ participants: localOffer.participants.filter(p => p.memberId !== memberId) });
  };
  
  // Helper to calculate dynamic share for display in tables
  const calculateDynamicEntryShare = (entry: DailyEntry) => {
      // Calculate based on CURRENT saved offer settings, not historical value in DB
      const base = localOffer.payoutModel === PayoutModel.REVENUE ? entry.revenue : entry.netProfit;
      return (base * (localOffer.teamPotPercent || 0)) / 100;
  }

  // Metrics for overview
  const totalRevenue = localOffer.dailyEntries.reduce((sum, e) => sum + e.revenue, 0);
  const totalAds = localOffer.dailyEntries.reduce((sum, e) => sum + e.adsSpend, 0);
  const totalProfit = totalRevenue - totalAds;
  const totalTeamPayout = localOffer.dailyEntries.reduce((sum, e) => sum + calculateDynamicEntryShare(e), 0);

  // --- Chart Data Logic ---
  const processChartData = () => {
    let start = new Date();
    let end = new Date();
    let granularity: 'day' | 'month' = 'day';

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
        const minDate = localOffer.dailyEntries.reduce((min, e) => e.date < min ? e.date : min, new Date().toISOString().split('T')[0]);
         const [y, m, d] = minDate.split('-').map(Number);
        start = new Date(y, m - 1, d);
    }

    const timeline = [];
    if (granularity === 'day') {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            timeline.push(new Date(d));
        }
    } else {
        let d = new Date(start);
        d.setDate(1);
        while (d <= end) {
            timeline.push(new Date(d));
            d.setMonth(d.getMonth() + 1);
        }
    }

    return timeline.map(date => {
        let label = '';
        let revenue = 0;
        let ads = 0;
        let profit = 0;
        let commission = 0;

        const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (granularity === 'day') {
             if (dateFilter === 'WEEK') {
                 label = date.toLocaleDateString('pt-BR', { weekday: 'short' });
                 label = label.charAt(0).toUpperCase() + label.slice(1);
             } else if (dateFilter === 'MONTH') {
                 label = String(date.getDate());
             } else {
                 label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
             }

             const entry = localOffer.dailyEntries.find(e => e.date === isoDate);
             if (entry) {
                 revenue = entry.revenue;
                 ads = entry.adsSpend;
                 profit = entry.netProfit;
                 commission = calculateDynamicEntryShare(entry);
             }

        } else {
             label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
             localOffer.dailyEntries.forEach(e => {
                 if (e.date.startsWith(monthKey)) {
                     revenue += e.revenue;
                     ads += e.adsSpend;
                     profit += e.netProfit;
                     commission += calculateDynamicEntryShare(e);
                 }
             });
        }

        return {
            name: label,
            revenue, // Blue
            ads,     // Red
            profit,  // Green
            commission
        };
    });
  };

  const chartData = useMemo(() => processChartData(), [localOffer.dailyEntries, dateFilter, customDates, viewGrouping, localOffer.payoutModel, localOffer.teamPotPercent]);
  
  // Calculate totals for selected period
  const filteredTotals = useMemo(() => {
     return chartData.reduce((acc, curr) => ({
        revenue: acc.revenue + curr.revenue,
        ads: acc.ads + curr.ads,
        profit: acc.profit + curr.profit,
        commission: acc.commission + curr.commission
     }), { revenue: 0, ads: 0, profit: 0, commission: 0 });
  }, [chartData]);

  const roas = filteredTotals.ads > 0 ? filteredTotals.revenue / filteredTotals.ads : 0;
  const margin = filteredTotals.revenue > 0 ? (filteredTotals.profit / filteredTotals.revenue) * 100 : 0;
  
  // Pie Chart Data
  const pieData = useMemo(() => {
     // Breakdown of Revenue:
     // 1. Ads Spend (Cost)
     // 2. Team Commission (Cost)
     // 3. Net Company Profit (What's left)
     const companyRealProfit = filteredTotals.revenue - filteredTotals.ads - filteredTotals.commission;
     
     return [
        { name: 'Lucro Real Empresa', value: Math.max(0, companyRealProfit), color: COL_PROFIT },
        { name: 'Investimento Ads', value: filteredTotals.ads, color: COL_ADS },
        { name: 'Comissão Equipe', value: filteredTotals.commission, color: COL_COMMISSION }
     ].filter(d => d.value > 0);
  }, [filteredTotals]);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
           <div className="flex-1">
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Target size={14} />
                <span>Oferta</span>
             </div>
             <input 
                className="text-2xl font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-slate-400"
                value={localOffer.name}
                onChange={(e) => updateLocal({ name: e.target.value })}
             />
           </div>
           <div className="flex items-center gap-3">
             <select 
                value={localOffer.status}
                onChange={(e) => updateLocal({ status: e.target.value as OfferStatus })}
                className={`text-sm font-semibold py-1.5 px-3 rounded-lg border outline-none cursor-pointer ${statusStyles.select}`}
             >
                <option value={OfferStatus.ACTIVE}>Ativa</option>
                <option value={OfferStatus.PAUSED}>Pausada</option>
                <option value={OfferStatus.ENDED}>Finalizada</option>
             </select>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
               <X size={24} />
             </button>
           </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {[
            { id: 'daily', label: 'Registro Diário', icon: Calendar },
            { id: 'analytics', label: 'Análise & Gráficos', icon: Activity },
            { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
            { id: 'team', label: 'Equipe & Regras', icon: Users },
            { id: 'history', label: 'Histórico', icon: Receipt },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
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

           {/* Tab: Daily Entry (The Core Feature) */}
           {activeTab === 'daily' && (
             <div className="max-w-3xl mx-auto">
                <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-md ring-1 ring-blue-50 mb-8">
                   <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                     <TrendingUp className="text-blue-600" />
                     Adicionar Registro de Hoje
                   </h3>
                   <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                        <input 
                          type="date" 
                          required
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Faturamento (Dia)</label>
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                           <input 
                              type="number" step="0.01" required
                              className="w-full pl-10 p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0,00"
                              value={entryRevenue}
                              onChange={(e) => setEntryRevenue(e.target.value)}
                           />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Investimento Ads</label>
                        <div className="relative">
                           <span className="absolute left-3 top-2.5 text-slate-400 font-bold">R$</span>
                           <input 
                              type="number" step="0.01" required
                              className="w-full pl-10 p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
                              placeholder="0,00"
                              value={entryAds}
                              onChange={(e) => setEntryAds(e.target.value)}
                           />
                        </div>
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                         <button type="submit" className="bg-slate-100 border border-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                           <Plus size={18} />
                           Adicionar à Lista (Não Salvo)
                         </button>
                      </div>
                   </form>
                   <p className="text-xs text-slate-400 mt-4 text-center">
                     * Clique em "Salvar Alterações" no rodapé para confirmar os registros.
                   </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="font-bold text-slate-700">Últimos Registros (Preview)</h4>
                   </div>
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                         <tr>
                           <th className="px-6 py-3">Data</th>
                           <th className="px-6 py-3 text-right">Faturamento</th>
                           <th className="px-6 py-3 text-right">Ads</th>
                           <th className="px-6 py-3 text-right">Lucro Real</th>
                           <th className="px-6 py-3 text-right">Share Equipe</th>
                           <th className="px-6 py-3 w-10"></th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {localOffer.dailyEntries.slice(0, 5).map(entry => (
                           <tr key={entry.id} className="hover:bg-slate-50">
                              <td className="px-6 py-3 text-slate-900">{new Date(entry.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                              <td className="px-6 py-3 text-right font-medium text-blue-600">R$ {entry.revenue.toLocaleString('pt-BR')}</td>
                              <td className="px-6 py-3 text-right font-medium text-rose-600">R$ {entry.adsSpend.toLocaleString('pt-BR')}</td>
                              <td className="px-6 py-3 text-right font-bold text-emerald-600">R$ {entry.netProfit.toLocaleString('pt-BR')}</td>
                              {/* DYNAMIC TEAM SHARE DISPLAY */}
                              <td className="px-6 py-3 text-right text-indigo-600">
                                  R$ {calculateDynamicEntryShare(entry).toLocaleString('pt-BR')}
                              </td>
                              <td className="px-6 py-3 text-right">
                                 <button onClick={() => deleteEntry(entry.id)} className="text-slate-300 hover:text-rose-500">
                                   <Trash2 size={16} />
                                 </button>
                              </td>
                           </tr>
                         ))}
                         {localOffer.dailyEntries.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Nenhum registro diário ainda.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
           )}

           {/* Tab: Analytics (New) */}
           {activeTab === 'analytics' && (
             <div className="space-y-6">
                 {/* Filter Bar */}
                 <div className="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                     <h3 className="text-sm font-bold text-slate-700 ml-2">Performance Financeira</h3>
                     <div className="flex items-center gap-2 relative">
                         {/* View Grouping Toggle */}
                         {(dateFilter === 'MONTH' || dateFilter === 'ALL' || dateFilter === 'CUSTOM') && (
                            <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
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

                         {['TODAY', 'WEEK', 'MONTH', 'ALL'].map((f) => (
                             <button
                                 key={f}
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

                 {/* KPI Summaries for Filtered Period */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase">Faturamento</p>
                        <p className="text-xl font-bold text-blue-600 mt-1">R$ {filteredTotals.revenue.toLocaleString('pt-BR')}</p>
                     </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase">Despesa (Ads)</p>
                        <p className="text-xl font-bold text-rose-600 mt-1">R$ {filteredTotals.ads.toLocaleString('pt-BR')}</p>
                     </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase">Lucro Líquido</p>
                        <p className="text-xl font-bold text-emerald-600 mt-1">R$ {filteredTotals.profit.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-slate-400 mt-1">Margem: {margin.toFixed(1)}%</p>
                     </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase">ROAS</p>
                        <p className="text-xl font-bold text-indigo-600 mt-1">{roas.toFixed(2)}x</p>
                     </div>
                 </div>

                 {/* Main Chart */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-slate-800">Visualização de Dados</h3>
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

                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
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
                                    <Bar dataKey="revenue" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                    <Bar dataKey="ads" name="Despesa (Ads)" fill={COL_ADS} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
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
                                    <Line type="monotone" dataKey="revenue" name="Faturamento" stroke={COL_REVENUE} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="ads" name="Despesa (Ads)" stroke={COL_ADS} strokeWidth={3} dot={false} />
                                    <Line type="monotone" dataKey="profit" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={false} />
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
                                // COMBO
                                <ComposedChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#64748b', fontSize: 12}} 
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} domain={[0, 'auto']} />
                                    <Tooltip 
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                                        labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                    />
                                    <Bar dataKey="revenue" name="Faturamento" fill={COL_REVENUE} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                    <Bar dataKey="ads" name="Despesa (Ads)" fill={COL_ADS} radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.9} />
                                    <Line type="monotone" dataKey="profit" name="Lucro Líquido" stroke={COL_PROFIT} strokeWidth={3} dot={{ r: 3, fill: COL_PROFIT, strokeWidth: 2, stroke: '#fff' }} />
                                </ComposedChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                 </div>
             </div>
           )}

           {/* Tab: Overview */}
           {activeTab === 'overview' && (
              <div className="max-w-3xl mx-auto space-y-6">
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição da Oferta</label>
                    <textarea 
                      className="w-full h-24 p-3 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 outline-none resize-none"
                      value={localOffer.description}
                      onChange={(e) => updateLocal({ description: e.target.value })}
                    />
                 </div>

                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Configurações Operacionais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Início</label>
                            <input 
                                type="date" 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                value={localOffer.startDate}
                                onChange={(e) => updateLocal({ startDate: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">A Checagem Diária só monitorará dias após esta data.</p>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status Atual</label>
                            <select 
                                value={localOffer.status}
                                onChange={(e) => updateLocal({ status: e.target.value as OfferStatus })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none"
                            >
                                <option value={OfferStatus.ACTIVE}>Ativa (Monitorando)</option>
                                <option value={OfferStatus.PAUSED}>Pausada (Sem Alertas)</option>
                                <option value={OfferStatus.ENDED}>Finalizada (Arquivada)</option>
                            </select>
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                       <p className="text-xs font-bold text-slate-400 uppercase">Faturamento Total</p>
                       <p className="text-2xl font-bold text-blue-600 mt-2">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                       <p className="text-xs font-bold text-slate-400 uppercase">Investimento Ads</p>
                       <p className="text-2xl font-bold text-rose-600 mt-2">R$ {totalAds.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                       <p className="text-xs font-bold text-slate-400 uppercase">Lucro Líquido</p>
                       <p className="text-2xl font-bold text-emerald-600 mt-2">R$ {totalProfit.toLocaleString('pt-BR')}</p>
                    </div>
                 </div>

                 <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                    <div className="flex justify-between items-center">
                       <div>
                          <p className="text-sm font-bold text-blue-900 uppercase">Repasse Total para Equipe</p>
                          <p className="text-xs text-blue-700 mt-1">Acumulado de todos os dias</p>
                       </div>
                       <p className="text-3xl font-bold text-blue-600">R$ {totalTeamPayout.toLocaleString('pt-BR')}</p>
                    </div>
                 </div>
              </div>
           )}

           {/* Tab: Team & Rules */}
           {activeTab === 'team' && (
              <div className="max-w-4xl mx-auto space-y-6">
                 {/* Configuration Panel */}
                 <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Target size={20} />
                            Regra de Comissionamento Global
                        </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                       <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Modelo Base</label>
                          <select 
                            value={localOffer.payoutModel}
                            onChange={(e) => updateLocal({payoutModel: e.target.value as PayoutModel})}
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                          >
                             <option value={PayoutModel.REVENUE}>% sobre FATURAMENTO (Bruto)</option>
                             <option value={PayoutModel.PROFIT}>% sobre LUCRO (Líquido)</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Comissão Global da Equipe</label>
                          <div className="relative">
                              <input 
                                type="number" min="0" max="100" step="0.1"
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                                value={localOffer.teamPotPercent !== undefined ? localOffer.teamPotPercent : 100}
                                onChange={(e) => updateLocal({teamPotPercent: Number(e.target.value)})}
                              />
                              <span className="absolute right-3 top-3 text-slate-400 font-bold">%</span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <p className="font-semibold mb-1">Como funciona o cálculo (Preview):</p>
                        <ul className="list-disc list-inside space-y-1 opacity-90">
                            <li><strong>1º Passo:</strong> O sistema separa <strong>{localOffer.teamPotPercent || 0}%</strong> do {localOffer.payoutModel === PayoutModel.REVENUE ? 'Faturamento Total' : 'Lucro Líquido'} para o "Pote da Equipe".</li>
                            <li><strong>2º Passo:</strong> Esse valor é distribuído entre os membros abaixo, conforme a porcentagem definida para cada um (Distribuição Interna).</li>
                        </ul>
                    </div>
                 </div>

                 {/* Participants Table */}
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h4 className="font-bold text-slate-700">Distribuição Interna (Divisão do Pote)</h4>
                       <select 
                          className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-700 outline-none"
                          onChange={(e) => {
                            if(e.target.value) {
                              handleAddParticipant(e.target.value);
                              e.target.value = '';
                            }
                          }}
                       >
                         <option value="">+ Adicionar Membro</option>
                         {data.members
                            .filter(m => !localOffer.participants.find(p => p.memberId === m.id))
                            .map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))
                         }
                       </select>
                    </div>
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                          <tr>
                             <th className="px-6 py-4">Membro</th>
                             <th className="px-6 py-4">Função</th>
                             <th className="px-6 py-4 text-right">% do Pote (Interno)</th>
                             <th className="px-6 py-4 text-right">Equivalente Global</th>
                             <th className="px-6 py-4 text-right">Ganho Acumulado</th>
                             <th className="px-6 py-4 w-10"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {localOffer.participants.map(p => {
                             const member = data.members.find(m => m.id === p.memberId);
                             if (!member) return null;
                             
                             // Effective Global % using LOCAL rules for preview
                             const effectivePercent = ((p.sharePercent || 0) * (localOffer.teamPotPercent || 0)) / 100;
                             
                             // Calculate accumulated share dynamically based on LOCAL settings (Preview)
                             const memberTotalEarnings = localOffer.dailyEntries.reduce((sum, entry) => {
                                const baseAmount = localOffer.payoutModel === PayoutModel.REVENUE ? entry.revenue : entry.netProfit;
                                const currentDayPot = (baseAmount * (localOffer.teamPotPercent || 0)) / 100;
                                const memberSlice = (currentDayPot * (p.sharePercent || 0)) / 100;
                                return sum + memberSlice;
                             }, 0);

                             return (
                                <tr key={p.memberId} className="hover:bg-slate-50">
                                   <td className="px-6 py-4 flex items-center gap-3">
                                      <InitialsAvatar name={member.name} size="sm" />
                                      <span className="font-medium text-slate-900">{member.name}</span>
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
                                            type="number" min="0" max="100" step="0.1"
                                            className="w-16 text-right bg-slate-50 border border-slate-200 rounded p-1 text-slate-900 font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                                            value={p.sharePercent}
                                            onChange={(e) => updateParticipant(p.memberId, 'sharePercent', Number(e.target.value))}
                                         />
                                         <span className="text-slate-400">%</span>
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-right text-slate-500 font-medium">
                                       {effectivePercent.toFixed(2)}%
                                   </td>
                                   <td className="px-6 py-4 text-right font-medium text-blue-600">
                                      R$ {memberTotalEarnings.toLocaleString('pt-BR')}
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                      <button onClick={() => removeParticipant(p.memberId)} className="text-slate-300 hover:text-rose-500">
                                         <X size={18} />
                                      </button>
                                   </td>
                                </tr>
                             )
                          })}
                          {localOffer.participants.length === 0 && (
                             <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Nenhum membro na equipe ainda.</td></tr>
                          )}
                       </tbody>
                       <tfoot className="bg-slate-50 border-t border-slate-200">
                          {(() => {
                              const totalDistributed = localOffer.participants.reduce((acc, p) => acc + p.sharePercent, 0);
                              const isInvalid = Math.abs(totalDistributed - 100) > 0.1 && localOffer.participants.length > 0;
                              
                              return (
                                <tr>
                                    <td colSpan={2} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Total Distribuído</td>
                                    <td className="px-6 py-3 text-right font-bold text-slate-900 flex justify-end items-center gap-2">
                                        <span className={isInvalid ? "text-amber-600" : "text-emerald-600"}>{totalDistributed.toFixed(1)}%</span>
                                        {isInvalid && <AlertCircle size={16} className="text-amber-500" title="A soma deve ser 100%" />}
                                    </td>
                                    <td colSpan={3} className="px-6 py-3">
                                        {isInvalid && <span className="text-xs text-amber-600 font-medium">A distribuição interna deve somar 100%</span>}
                                    </td>
                                </tr>
                              );
                          })()}
                       </tfoot>
                    </table>
                 </div>
              </div>
           )}

           {/* Tab: History (Full Table) */}
           {activeTab === 'history' && (
              <div className="max-w-4xl mx-auto">
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4">Data</th>
                             <th className="px-6 py-4 text-right">Faturamento</th>
                             <th className="px-6 py-4 text-right">Ads</th>
                             <th className="px-6 py-4 text-right">Lucro Real</th>
                             <th className="px-6 py-4 text-right">Share Equipe</th>
                             <th className="px-6 py-4 w-10"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {localOffer.dailyEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => (
                             <tr key={entry.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 text-slate-900">{new Date(entry.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                <td className="px-6 py-4 text-right font-medium text-blue-600">R$ {entry.revenue.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 text-right font-medium text-rose-600">R$ {entry.adsSpend.toLocaleString('pt-BR')}</td>
                                <td className="px-6 py-4 text-right font-bold text-emerald-600">R$ {entry.netProfit.toLocaleString('pt-BR')}</td>
                                {/* DYNAMIC TEAM SHARE DISPLAY */}
                                <td className="px-6 py-4 text-right text-indigo-600">
                                    R$ {calculateDynamicEntryShare(entry).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button onClick={() => deleteEntry(entry.id)} className="text-slate-300 hover:text-rose-500">
                                     <Trash2 size={16} />
                                   </button>
                                </td>
                             </tr>
                          ))}
                          {localOffer.dailyEntries.length === 0 && (
                             <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Histórico vazio.</td></tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
           <button 
             type="button"
             onClick={(e) => { e.stopPropagation(); onDelete(); }}
             className="text-rose-500 text-sm font-medium hover:text-rose-700 flex items-center gap-2 px-3 py-2 rounded hover:bg-rose-50 transition-colors"
           >
             <Trash2 size={16} />
             Excluir Oferta
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

// --- Sub-Component: Create Offer Modal ---

const CreateOfferModal = ({ onClose, onSave }: { onClose: () => void, onSave: (o: Omit<Offer, 'id'>) => void }) => {
  const [form, setForm] = useState({
    name: '',
    payoutModel: PayoutModel.REVENUE,
    startDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      description: '',
      status: OfferStatus.ACTIVE,
      active: true,
      teamPotPercent: 100, // Default to 100% (Direct Share) initially, user can change later
      participants: [],
      dailyEntries: []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Nova Oferta</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Oferta</label>
            <input required autoFocus className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Curso de Marketing" />
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Comissão da Equipe</label>
             <select 
               className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 outline-none"
               value={form.payoutModel}
               onChange={e => setForm({...form, payoutModel: e.target.value as PayoutModel})}
             >
                <option value={PayoutModel.REVENUE}>% sobre FATURAMENTO (Bruto)</option>
                <option value={PayoutModel.PROFIT}>% sobre LUCRO (Líquido)</option>
             </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
            <input required type="date" className="w-full bg-white text-slate-900 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 flex items-center gap-2">
                <Save size={18} />
                Criar Oferta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
