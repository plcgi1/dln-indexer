export default async function TopNavigation() {
    return (
        <nav className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">Σ</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">
                            SolanaStream 
                            <span className="text-indigo-600">Analytics</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live Network
                        </span>
                    </div>
                </div>
            </nav>
    )
}