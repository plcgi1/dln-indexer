'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EVENT_TYPE_LABELS } from '@/lib/event-labels';

export default function FilterSidebar({ initialRange }: { initialRange: string | string[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentRange = Array.isArray(initialRange)
        ? initialRange[0]
        : initialRange;

    // Локальное состояние для фильтров (чтобы Apply применял всё сразу)
    const [range, setRange] = useState(currentRange);
    const [eventName, setEventName] = useState<string[]>(
        searchParams.get('eventName')?.split(',') || Object.values(EVENT_TYPE_LABELS)
    );
    const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
    const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');

    const handleApply = () => {
        const params = new URLSearchParams();
        params.set('range', range);
        params.set('eventName', eventName.join(','));
        if (range === 'custom') {
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
        }
        // Обновляем URL (это триггерит серверный компонент page.tsx)
        router.push(`?${params.toString()}`);

        router.refresh();
    };

    const toggleType = (type: string) => {
        setEventName(prev =>
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
                    <option value="custom">Custom dates</option>
                </select>
            </div>
            {range === 'custom' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">От (YYYY-MM-DD)</label>
                        <input 
                            type="date" 
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">До (YYYY-MM-DD)</label>
                        <input 
                            type="date" 
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                </div>
            )}
            {/* Выбор типов */}
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Event Types</label>
                <div className="space-y-2">
                    {Object.values(EVENT_TYPE_LABELS).map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                                type="checkbox"
                                checked={eventName.includes(t)}
                                onChange={() => toggleType(t)}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            {t === EVENT_TYPE_LABELS.OrderCreated ? EVENT_TYPE_LABELS.OrderCreated : EVENT_TYPE_LABELS.OrderFulfilled}
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