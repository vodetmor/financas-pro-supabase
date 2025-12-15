
import React, { useState, useMemo } from 'react';
import { AppState, Offer, OfferStatus, DailyEntry, PayoutModel } from '../types';
import { CheckSquare, Calendar, AlertTriangle, Plus, X, ArrowRight, CheckCircle, TrendingUp, Filter } from 'lucide-react';

interface DailyCheckProps {
  data: AppState;
  onUpdateOffer: (id: string, updates: Partial<Offer>) => void;
}

export const DailyCheck: React.FC<DailyCheckProps> = ({ data, onUpdateOffer }) => {
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<{ offerId: string, date: string, offerName: string } | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    revenue: '',
    adsSpend: ''
  });

  // 1. Logic to identify missing entries
  const pendingTasks = useMemo(() => {
    const tasks: { offerId: string, offerName: string, date: string, offer: Offer }[] = [];
    const today = new Date();
    
    // Check last 30 days
    const datesToCheck: string[] = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        // Use local date parts to construct YYYY-MM-DD to match user's day exactly
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        datesToCheck.push(`${year}-${month}-${day}`);
    }

    data.offers.forEach(offer => {
        // STRICT RULE: Daily Check only monitors ACTIVE offers. 
        // Paused and Ended offers are completely ignored.
        if (offer.status !== OfferStatus.ACTIVE) return;

        datesToCheck.forEach(date => {
            // STRICT RULE: Don't check dates before offer start
            if (date < offer.startDate) return;
            // Don't check future if offer has end date
            if (offer.endDate && date > offer.endDate) return;

            // Check if entry exists
            const hasEntry = offer.dailyEntries.some(e => e.date === date);
            
            if (!hasEntry) {
                tasks.push({
                    offerId: offer.id,
                    offerName: offer.name,
                    date: date,
                    offer: offer
                });
            }
        });
    });

    // Sort: Most recent first
    return tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.offers]);

  const openResolveModal = (task: typeof pendingTasks[0]) => {
    setSelectedTask(task);
    setFormData({ revenue: '', adsSpend: '' });
    setResolveModalOpen(true);
  };

  const handleResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    const offer = data.offers.find(o => o.id === selectedTask.offerId);
    if (!offer) return;

    const revenue = parseFloat(formData.revenue) || 0;
    const ads = parseFloat(formData.adsSpend) || 0;
    const netProfit = revenue - ads;

    // Calculation Logic (Mirrored from Offers.tsx)
    let baseAmount = offer.payoutModel === PayoutModel.REVENUE ? revenue : netProfit;
    const teamShare = (baseAmount * (offer.teamPotPercent || 0)) / 100;

    const newEntry: DailyEntry = {
        id: Date.now().toString(),
        date: selectedTask.date,
        revenue,
        adsSpend: ads,
        netProfit,
        teamShare
    };

    onUpdateOffer(offer.id, {
        dailyEntries: [newEntry, ...offer.dailyEntries]
    });

    setResolveModalOpen(false);
    setSelectedTask(null);
  };

  // Grouping for UI
  // Use local time for comparison to match pendingTasks generation
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const tasksToday = pendingTasks.filter(t => t.date === todayStr);
  const tasksOverdue = pendingTasks.filter(t => t.date !== todayStr);

  const complianceRate = useMemo(() => {
     if (data.offers.filter(o => o.status === OfferStatus.ACTIVE).length === 0) return 100;
     // Rough estimate: Total checks vs missing
     // Let's just do a simpler visual: Active Offers fully up to date / Total Active Offers
     const activeOffers = data.offers.filter(o => o.status === OfferStatus.ACTIVE);
     const cleanOffers = activeOffers.filter(o => !pendingTasks.some(t => t.offerId === o.id));
     return Math.round((cleanOffers.length / activeOffers.length) * 100) || 0;
  }, [data.offers, pendingTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checagem Diária</h1>
          <p className="text-slate-500">Central de conformidade e verificação de dados</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Conformidade Atual:</span>
            <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            complianceRate === 100 ? 'bg-emerald-500' : 
                            complianceRate > 50 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} 
                        style={{ width: `${complianceRate}%` }}
                    />
                </div>
                <span className={`font-bold ${
                     complianceRate === 100 ? 'text-emerald-600' : 
                     complianceRate > 50 ? 'text-amber-600' : 'text-rose-600'
                }`}>{complianceRate}%</span>
            </div>
        </div>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-12 text-center animate-fade-in">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900">Tudo em dia!</h2>
            <p className="text-emerald-700 mt-2">Todas as ofertas ativas possuem os registros financeiros atualizados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Task List */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Today's Tasks */}
                {tasksToday.length > 0 && (
                    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center gap-2">
                            <Calendar className="text-blue-600" size={20} />
                            <h3 className="font-bold text-blue-900">Pendente Hoje ({tasksToday.length})</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {tasksToday.map((task, idx) => (
                                <div key={`${task.offerId}-${task.date}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800">{task.offerName}</p>
                                        <p className="text-xs text-slate-500">Registro de hoje pendente</p>
                                    </div>
                                    <button 
                                        onClick={() => openResolveModal(task)}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                                    >
                                        Resolver <ArrowRight size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Overdue Tasks */}
                {tasksOverdue.length > 0 && (
                    <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
                        <div className="bg-rose-50 px-6 py-4 border-b border-rose-100 flex items-center gap-2">
                            <AlertTriangle className="text-rose-600" size={20} />
                            <h3 className="font-bold text-rose-900">Atrasados ({tasksOverdue.length})</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {tasksOverdue.map((task, idx) => (
                                <div key={`${task.offerId}-${task.date}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-800">{task.offerName}</p>
                                        <p className="text-xs text-rose-600 font-medium">
                                            Esquecido em: {new Date(task.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => openResolveModal(task)}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors"
                                    >
                                        Resolver <ArrowRight size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Summary / Stats Side */}
            <div className="space-y-4">
                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <CheckSquare size={20} /> Resumo
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-300">Total Pendente</span>
                            <span className="font-bold text-xl">{pendingTasks.length}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-300">Ofertas Ativas</span>
                            <span className="font-bold text-xl">{data.offers.filter(o => o.status === OfferStatus.ACTIVE).length}</span>
                        </div>
                        <div className="pt-2">
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Manter os registros em dia garante que o cálculo de comissões e o dashboard financeiro estejam sempre precisos. Apenas ofertas ATIVAS são monitoradas.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button 
                    onClick={() => setResolveModalOpen(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                    <X size={20} />
                </button>

                <div className="mb-6">
                    <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold mb-2">
                        {new Date(selectedTask.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">{selectedTask.offerName}</h3>
                    <p className="text-slate-500 text-sm">Insira os dados financeiros faltantes.</p>
                </div>

                <form onSubmit={handleResolve} className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Faturamento (R$)</label>
                        <input 
                            type="number" step="0.01" required autoFocus
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0,00"
                            value={formData.revenue}
                            onChange={(e) => setFormData({...formData, revenue: e.target.value})}
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Investimento Ads (R$)</label>
                        <input 
                            type="number" step="0.01" required
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
                            placeholder="0,00"
                            value={formData.adsSpend}
                            onChange={(e) => setFormData({...formData, adsSpend: e.target.value})}
                        />
                     </div>

                     <div className="pt-4 flex gap-3">
                         <button 
                            type="button" 
                            onClick={() => setResolveModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                         >
                            Cancelar
                         </button>
                         <button 
                            type="submit" 
                            className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
                         >
                            Salvar Registro
                         </button>
                     </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
};
