import React from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Aceptar",
    cancelText = "Cancelar",
    type = "warning" // warning, success, info
}) => {
    if (!isOpen) return null;

    const icons = {
        warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
        success: <CheckCircle2 className="w-12 h-12 text-green-500" />,
        info: <CircleHelp className="w-12 h-12 text-blue-500" />
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
                <div className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                        {icons[type]}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500">{message}</p>
                </div>
                <div className="flex border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 text-gray-600 font-medium hover:bg-gray-50 transition border-r border-gray-100"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-6 py-4 font-bold transition
                            ${type === 'warning' ? 'text-blue-600 hover:bg-blue-50' : ''}
                            ${type === 'success' ? 'text-green-600 hover:bg-green-50' : ''}
                            ${type === 'info' ? 'text-blue-600 hover:bg-blue-50' : ''}
                        `}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
