import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal } from './Modal';
import { CheckCircle, AlertCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type ModalType = 'success' | 'error' | 'info' | 'warning' | 'confirm';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message?: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface ModalContextType {
  showModal: (config: Omit<ModalState, 'isOpen'>) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showModal = useCallback((config: Omit<ModalState, 'isOpen'>) => {
    setModalState({
      ...config,
      isOpen: true,
    });
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    showModal({
      type: 'success',
      title,
      message,
      variant: 'info',
    });
  }, [showModal]);

  const showError = useCallback((title: string, message?: string) => {
    showModal({
      type: 'error',
      title,
      message,
      variant: 'danger',
    });
  }, [showModal]);

  const showWarning = useCallback((title: string, message?: string) => {
    showModal({
      type: 'warning',
      title,
      message,
      variant: 'warning',
    });
  }, [showModal]);

  const showInfo = useCallback((title: string, message?: string) => {
    showModal({
      type: 'info',
      title,
      message,
      variant: 'info',
    });
  }, [showModal]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'danger' | 'warning' | 'info' = 'info'
  ) => {
    showModal({
      type: 'confirm',
      title,
      message,
      onConfirm,
      variant,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
  }, [showModal]);

  const handleConfirm = () => {
    if (modalState.onConfirm) {
      modalState.onConfirm();
    }
    closeModal();
  };

  // Get icon based on type
  const getIcon = () => {
    const iconClass = "w-5 h-5";
    switch (modalState.type) {
      case 'success':
        return <CheckCircle className={iconClass} />;
      case 'error':
        return <XCircle className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
      case 'info':
      case 'confirm':
        return <Info className={iconClass} />;
      default:
        return <Info className={iconClass} />;
    }
  };

  const variantColors = {
    danger: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  };

  const buttonColors = {
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-500',
    info: 'bg-indigo-600 hover:bg-indigo-500',
    success: 'bg-emerald-600 hover:bg-emerald-500',
  };

  const variant = modalState.variant || 'info';

  return (
    <ModalContext.Provider
      value={{ showModal, showSuccess, showError, showWarning, showInfo, showConfirm, closeModal }}
    >
      {children}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className="relative glass-card rounded-2xl p-6 max-w-md w-full border border-white/10 animate-fade-in">
            <div className="flex items-start gap-4 mb-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${variantColors[variant]}`}>
                {getIcon()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">{modalState.title}</h3>
                {modalState.message && (
                  <p className="text-sm text-slate-400">{modalState.message}</p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              {modalState.type === 'confirm' && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                >
                  {modalState.cancelText || 'Cancel'}
                </button>
              )}
              <button
                onClick={modalState.type === 'confirm' ? handleConfirm : closeModal}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${buttonColors[variant]}`}
              >
                {modalState.type === 'confirm' ? (modalState.confirmText || 'Confirm') : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

