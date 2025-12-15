import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all transform translate-y-0 opacity-100 ${type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
            {type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
                <AlertCircle className="w-5 h-5 text-rose-500" />
            )}
            <span className="text-sm font-medium">{message}</span>
            <button onClick={onClose} className={`p-1 rounded-full hover:bg-black/5 ${type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
