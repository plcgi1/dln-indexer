'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function FilterSidebar({ initialRange }: { initialRange: string | string[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentRange = Array.isArray(initialRange)
        ? initialRange[0]
        : initialRange;

    // Локальное состояние для фильтров (чтобы Apply применял всё сразу)
    const [range, setRange] = useState(currentRange);
    const [types, setTypes] = useState<string[]>(
        searchParams.get('types')?.split(',') || ['SOURCE', 'DESTINATION']
    );

    const handleApply = () => {
        const params = new URLSearchParams();
        params.set('range', range);
        params.set('types', types.join(','));

        // Обновляем URL (это триггерит серверный компонент page.tsx)
        router.push(`?${params.toString()}`);

        router.refresh();
    };

    const toggleType = (type: string) => {
        setTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">Filters</h4>

            {/* Выбор диапазона */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Period</label>
                <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="24h">Last 24 hours</option>
                    <option value="3d">Last 3 days</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                </select>
            </div>

            {/* Выбор типов */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Event Types</label>
                <div className="space-y-2">
                    {['SOURCE', 'DESTINATION'].map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                                type="checkbox"
                                checked={types.includes(t)}
                                onChange={() => toggleType(t)}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            {t === 'SOURCE' ? 'Source' : 'Destination'}
                        </label>
                    ))}
                </div>
            </div>

            {/* Кнопка действия */}
            <button
                onClick={handleApply}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-all shadow-md shadow-indigo-100 active:scale-[0.98]"
            >
                Apply Changes
            </button>
        </div>
    );
}