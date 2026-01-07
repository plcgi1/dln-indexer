"use client";
import { useState, useMemo } from 'react';
import VolumeChart from './VolumeChart';

export default function DashboardWrapper({ initialData }: { initialData: any[] }) {
    const [data, ] = useState(initialData);

    const totals = useMemo(() => {
        if(data.length === 0) return { source: 0, destination: 0 };
        return data.reduce((acc, curr) => {
            const s = Number(curr.source) || 0;
            const d = Number(curr.destination) || 0;

            return {
                source: acc.source + s,
                destination: acc.destination + d
            };
        })
    }, [data]);

    return (
        <div className="flex flex-col gap-8">
            {/* КАРТОЧКИ С ИТОГАМИ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Created</p>
                    <h3 className="text-3xl font-black text-indigo-600">
                        ${totals.source.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Fulfilled</p>
                    <h3 className="text-3xl font-black text-emerald-500">
                        ${totals.destination.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h3>
                </div>
            </div>

            {/* ГРАФИК */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <VolumeChart data={data} />
            </div>
        </div>
    );
}