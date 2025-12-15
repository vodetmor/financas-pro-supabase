import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
      onClick={(e) => { e.stopPropagation(); onCancel(); }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 transform transition-all scale-100 opacity-100" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors shadow-sm"
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  );
};