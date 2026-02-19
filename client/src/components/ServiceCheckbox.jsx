import { Check } from 'lucide-react';

const ServiceCheckbox = ({ label, price, checked, onChange, icon: Icon }) => {
    return (
        <div
            onClick={() => onChange(!checked)}
            className={`
                cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all duration-200
                ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
            `}
        >
            <div className="flex items-center gap-3">
                <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${checked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}
                `}>
                    {Icon && <Icon className="w-5 h-5" />}
                </div>
                <div>
                    <h3 className={`font-medium ${checked ? 'text-blue-700' : 'text-gray-700'}`}>
                        {label}
                    </h3>
                    <p className="text-sm text-gray-500">+${price}</p>
                </div>
            </div>

            <div className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center
                ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
            `}>
                {checked && <Check className="w-4 h-4 text-white" />}
            </div>
        </div>
    );
};

export default ServiceCheckbox;
