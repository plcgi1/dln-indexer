export default async function StatsGrid({ totalVolume, statLength, currentRange }: { totalVolume: number, statLength: number, currentRange: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Total {currentRange} Volume</p>
                <h4 className="text-2xl font-bold text-slate-900">${totalVolume.toFixed(9)}</h4>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Transactions</p>
                <h4 className="text-2xl font-bold text-slate-900">{statLength.toLocaleString()}</h4>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500 mb-1">Avg. Tx Value</p>
                <h4 className="text-2xl font-bold text-slate-900">
                    ${(totalVolume / (statLength || 1)).toFixed(9)}
                </h4>
            </div>
        </div>
    )
}