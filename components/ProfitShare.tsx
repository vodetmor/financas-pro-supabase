
import React, { useState, useRef } from 'react';
import { AppState, TeamMember, TransactionType, Service } from '../types';
import { Users, Plus, Pencil, Trash2, X, CheckSquare, Settings, Calculator, PieChart as PieIcon, Briefcase, Calendar } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { DateRangePicker } from './DateRangePicker';

interface ProfitShareProps {
  data: AppState;
  onAddMember: (m: Omit<TeamMember, 'id'>) => void;
  onUpdateMember: (id: string, updates: Partial<TeamMember>) => void;
  onDeleteMember: (id: string) => void;
}

export const ProfitShare: React.FC<ProfitShareProps> = ({ data, onAddMember, onUpdateMember, onDeleteMember }) => {
  const [isManaging, setIsManaging] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  // Date Filter State
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('MONTH');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  
  // Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  // Ref for auto-scrolling to form
  const topRef = useRef<HTMLDivElement>(null);

  // Weights for calculator
  const [memberWeights, setMemberWeights] = useState<Record<string, number>>({});

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    defaultSharePercent: '',
  });

  // Filter Helpers
  const filterByDate = (items: any[], dateField: string) => {
    if (dateFilter === 'ALL') return items;
    
    if (dateFilter === 'CUSTOM') {
       if (!customDates.start && !customDates.end) return items;
       
       const from = customDates.start ? new Date(customDates.start).setHours(0,0,0,0) : -Infinity;
       const to = customDates.end ? new Date(customDates.end).setHours(23,59,59,999) : Infinity;

       return items.filter(item => {
          const t = new Date(item[dateField]).getTime();
          return t >= from && t <= to;
       });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      if (dateFilter === 'TODAY') return itemDate >= todayStart;
      if (dateFilter === 'WEEK') return itemDate >= weekStart;
      if (dateFilter === 'MONTH') return itemDate >= monthStart;
      return true;
    });
  };

  const filteredTransactions = filterByDate(data.transactions, 'date');

  const calculateGlobalPool = () => {
    const revenue = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    return { revenue, expenses, profit: revenue - expenses };
  };

  const pool = calculateGlobalPool();
  const members = data.members || []; // Safety fallback
  const totalAllocatedPercent = members.reduce((sum, m) => sum + (m.defaultSharePercent || 0), 0);

  const resetForm = () => {
    setEditingMember(null);
    setFormData({ name: '', role: '', defaultSharePercent: '' });
  };

  const handleEditClick = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      role: member.role,
      defaultSharePercent: member.defaultSharePercent.toString(),
    });
    setIsManaging(true);
    // Scroll to the form so the user sees it
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      role: formData.role,
      defaultSharePercent: Number(formData.defaultSharePercent),
      avatarUrl: '', 
    };

    if (editingMember) {
      onUpdateMember(editingMember.id, payload);
    } else {
      onAddMember(payload);
    }
    resetForm();
    setIsManaging(false); 
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      onDeleteMember(deleteConfirm.id);
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  // Calculator Logic
  const distributeEqually = () => {
    const count = members.length;
    if (count === 0) return;
    const share = Number((100 / count).toFixed(2));
    
    // Distribute remaining decimals to first member
    const total = share * count;
    const diff = 100 - total;

    members.forEach((m, index) => {
      let finalShare = share;
      if (index === 0) finalShare += diff; // Adjust rounding
      onUpdateMember(m.id, { defaultSharePercent: Number(finalShare.toFixed(2)) });
    });
  };

  const handleWeightChange = (id: string, weight: string) => {
    setMemberWeights(prev => ({ ...prev, [id]: Number(weight) }));
  };

  const applyWeights = () => {
    const totalWeight = members.reduce((sum, m) => sum + (memberWeights[m.id] || 1), 0);
    if (totalWeight === 0) return;

    members.forEach(m => {
      const weight = memberWeights[m.id] || 1;
      const percent = (weight / totalWeight) * 100;
      onUpdateMember(m.id, { defaultSharePercent: Number(percent.toFixed(2)) });
    });
    setIsCalculatorOpen(false);
  };

  // Service Breakdown Helper - Uses Filtered Transactions
  const getServiceFinancials = (service: Service) => {
    const serviceIncome = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME && t.serviceId === service.id)
      .reduce((acc, t) => acc + t.amount, 0);
    
    // Expenses assigned to service
    const serviceExpense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.serviceId === service.id)
      .reduce((acc, t) => acc + t.amount, 0);

    return { income: serviceIncome, expense: serviceExpense, profit: serviceIncome - serviceExpense };
  };

  return (
    <div ref={topRef} className="space-y-6">
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="Excluir Membro"
        message="Tem certeza que deseja excluir este membro da equipe? Ele será removido automaticamente de todos os projetos e transações associadas."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Divisão de Lucros & Equipe</h1>
          <p className="text-slate-500">Gestão de sócios e distribuição de resultados</p>
        </div>

         {/* Date Filter Bar */}
         <div className="flex flex-col items-end gap-2 relative z-20">
            <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
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
                    dateFilter === 'CUSTOM' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
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
                    if (start && end) setDateFilter('CUSTOM');
                  }}
                  onClose={() => setShowCustomPicker(false)}
                  onApply={() => { setShowCustomPicker(false); setDateFilter('CUSTOM'); }}
                />
            )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
          <button 
            type="button"
            onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors border ${isCalculatorOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Calculator size={18} className="mr-2" />
            Calculadora
          </button>
          <button 
            type="button"
            onClick={() => { resetForm(); setIsManaging(!isManaging); }}
            className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${isManaging ? 'bg-slate-200 text-slate-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {isManaging ? <X size={18} className="mr-2" /> : <Settings size={18} className="mr-2" />}
            {isManaging ? 'Fechar Gestão' : 'Gerenciar Equipe'}
          </button>
      </div>

      {/* Global Summary Card */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4 opacity-75">
            <Calendar size={14} />
            <span className="text-xs font-medium uppercase tracking-wider">
                {dateFilter === 'ALL' ? 'Todo o Período' : 
                 dateFilter === 'TODAY' ? 'Hoje' :
                 dateFilter === 'WEEK' ? 'Esta Semana' :
                 dateFilter === 'MONTH' ? 'Este Mês' : 'Período Personalizado'}
            </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center md:text-left">
          <div className="col-span-1 md:col-span-1">
             <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Lucro Líquido (Período)</p>
             <h2 className="text-3xl font-bold mt-1 text-emerald-400">R$ {pool.profit.toLocaleString('pt-BR')}</h2>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
             <p className="text-slate-400 text-xs">Faturamento</p>
             <p className="text-lg font-semibold text-white">R$ {pool.revenue.toLocaleString('pt-BR')}</p>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
             <p className="text-slate-400 text-xs">Despesas</p>
             <p className="text-lg font-semibold text-rose-300">R$ {pool.expenses.toLocaleString('pt-BR')}</p>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
             <p className="text-slate-400 text-xs">Margem</p>
             <p className="text-lg font-semibold text-blue-300">
               {pool.revenue > 0 ? ((pool.profit / pool.revenue) * 100).toFixed(1) : 0}%
             </p>
          </div>
        </div>
      </div>

      {/* Smart Calculator Panel */}
      {isCalculatorOpen && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <PieIcon size={18} />
              Calculadora de Distribuição Inteligente
            </h3>
            <button 
              type="button"
              onClick={distributeEqually}
              className="text-sm bg-indigo-200 text-indigo-800 px-3 py-1 rounded-full hover:bg-indigo-300 transition-colors font-medium"
            >
              Dividir Igualmente (1/{members.length})
            </button>
          </div>
          
          <p className="text-sm text-indigo-700 mb-4">
            Defina "Cotas" (pesos) para cada membro. O sistema calculará a porcentagem automaticamente. 
            <br/><span className="text-xs opacity-75">Ex: Membro A (2 cotas) e Membro B (1 cota) = 66% / 33%.</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {members.map(m => (
              <div key={m.id} className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                <span className="font-medium text-slate-700">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase">Cotas</span>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="1"
                    className="w-16 p-1 border border-slate-300 rounded text-center bg-white text-slate-900"
                    value={memberWeights[m.id] ?? 1}
                    onChange={(e) => handleWeightChange(m.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button 
              type="button"
              onClick={applyWeights}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Aplicar Nova Distribuição (%)
            </button>
          </div>
        </div>
      )}

      {/* Management Form Area */}
      {isManaging && (
        <div className="bg-slate-100 border border-slate-200 p-6 rounded-xl animate-fade-in ring-2 ring-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            {editingMember ? <Pencil size={18} className="text-blue-600" /> : <Plus size={18} className="text-emerald-600" />}
            {editingMember ? 'Editar Membro' : 'Adicionar Novo Membro'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input 
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cargo / Função</label>
              <input 
                required
                type="text"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="Ex: Vendas"
              />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">% Lucro</label>
              <input 
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.defaultSharePercent}
                onChange={e => setFormData({...formData, defaultSharePercent: e.target.value})}
                className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none"
                placeholder="0-100"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              {editingMember && (
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="px-4 py-2.5 border border-slate-300 bg-white text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex-1 md:flex-none whitespace-nowrap"
              >
                {editingMember ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm uppercase tracking-wider">Membro</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm uppercase tracking-wider">Cargo</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm uppercase tracking-wider text-right">% Global</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm uppercase tracking-wider text-right">Valor Estimado ({dateFilter === 'ALL' ? 'Total' : dateFilter === 'MONTH' ? 'Mês' : 'Filtro'})</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-sm uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => {
                const shareAmount = (pool.profit * member.defaultSharePercent) / 100;
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-medium flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs border border-slate-200">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      {member.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{member.role}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block px-2 py-1 bg-slate-100 rounded text-slate-700 font-semibold text-sm">
                        {member.defaultSharePercent}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      R$ {shareAmount > 0 ? shareAmount.toLocaleString('pt-BR') : '0,00'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEditClick(member); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                          title="Editar"
                        >
                          <Pencil size={18} className="pointer-events-none" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(member.id); }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} className="pointer-events-none" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Totals Row */}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="px-6 py-4 text-slate-500 text-right">Total Alocado:</td>
                <td className={`px-6 py-4 text-right ${totalAllocatedPercent !== 100 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {totalAllocatedPercent.toFixed(2)}%
                  {Math.abs(totalAllocatedPercent - 100) > 0.1 && <AlertCircleIcon />}
                </td>
                <td className="px-6 py-4 text-right text-slate-900">
                  R$ {((pool.profit * totalAllocatedPercent) / 100).toLocaleString('pt-BR')}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {Math.abs(totalAllocatedPercent - 100) > 0.1 && (
         <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded shadow-sm text-sm text-amber-800 flex items-center gap-3">
            <CheckSquare className="text-amber-500" size={20} />
            <p>
              <strong>Atenção:</strong> A soma das porcentagens é de <strong>{totalAllocatedPercent.toFixed(2)}%</strong>. 
              {totalAllocatedPercent < 100 
                ? ' Ainda falta alocar ' + (100 - totalAllocatedPercent).toFixed(2) + '% do lucro.' 
                : ' Você alocou mais que 100%, revise as porcentagens.'}
            </p>
         </div>
      )}

      {/* Service-Based Profit Breakdown */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Briefcase size={20} className="text-slate-400" />
          Lucro Detalhado por Serviço (Baseado no Período)
        </h2>
        <p className="text-slate-500 mb-6">
          Visualização do lucro individual de cada serviço, baseado nas transações do período selecionado.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(data.services || []).map(service => {
            const financials = getServiceFinancials(service);
            const participants = service.participants || [];
            
            // If no activity in this period, maybe hide it? Or show with 0s. 
            // Showing all services lets you see which ones had no revenue.
            
            return (
              <div key={service.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-800">{service.clientName} - {service.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${financials.profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    Lucro Período: R$ {financials.profit.toLocaleString('pt-BR')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                   <div>
                     <span className="text-slate-500">Receita:</span>
                     <span className="ml-2 font-medium text-emerald-600">+ R$ {financials.income.toLocaleString('pt-BR')}</span>
                   </div>
                   <div>
                     <span className="text-slate-500">Despesa:</span>
                     <span className="ml-2 font-medium text-rose-600">- R$ {financials.expense.toLocaleString('pt-BR')}</span>
                   </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Divisão ({participants.length})</p>
                  <ul className="space-y-2">
                    {participants.map(p => {
                      const member = members.find(m => m.id === p.memberId);
                      if (!member) return null;
                      
                      const memberShareAmount = (financials.profit * (p.sharePercent || 0)) / 100;

                      return (
                        <li key={p.memberId} className="flex justify-between text-sm">
                          <span className="text-slate-700">{member.name} <span className="text-slate-400 text-xs">({p.sharePercent}%)</span></span>
                          <span className="font-bold text-slate-900">R$ {memberShareAmount.toLocaleString('pt-BR')}</span>
                        </li>
                      );
                    })}
                    {participants.length === 0 && (
                      <li className="text-slate-400 italic text-sm">Nenhum membro atribuído</li>
                    )}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

const AlertCircleIcon = () => (
  <span className="inline-block ml-1 text-amber-500" title="A soma deve ser 100%">⚠️</span>
);
