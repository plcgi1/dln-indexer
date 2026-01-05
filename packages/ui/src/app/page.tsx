import { prisma } from '@/lib/prisma'
import { FilterSchema } from "@/lib/validations";
import DashboardWrapper from '@/components/DashboardWrapper'
import FilterSidebar from "@/components/FilterSidebar";
import { Suspense } from "react";
import TopNavigation from '@/components/TopNavigation';
import StatsGrid from '@/components/StatsGrid';

// включение SSR для этой страницы
export const dynamic = 'force-dynamic'

export function getPrismaWhere(rawParams: any) {
    const result = FilterSchema.safeParse(rawParams);

    const params = result.success ? result.data : FilterSchema.parse({});

    let startDate = new Date();
    const endDate = params.dateTo ? new Date(params.dateTo) : new Date();

    if (params.range === 'custom' && params.dateFrom) {
        startDate = new Date(params.dateFrom);
    } else {
        const offsets: Record<string, number> = {
            '24h': 24 * 60 * 60 * 1000,
            '3d': 3 * 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
        };
        startDate = new Date(endDate.getTime() - (offsets[params.range] || offsets['24h']));
    }

    return {
        trnDate: {
            gte: startDate,
            lte: endDate,
        },
        trnEventType: {
            in: params.types, // Zod уже превратил строку в массив ['SOURCE', 'DESTINATION']
        },
    };
}

export default async function Page({ searchParams }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedSearchParams = await searchParams;

    const where = getPrismaWhere(resolvedSearchParams);

    const stats = await prisma.trnLog.findMany({
        where,
        orderBy: { trnDate: 'asc' }
    })
    const currentRange = resolvedSearchParams.range || '24h';

    // Группировка данных (логика из предыдущего шага)
    const formattedData = stats.reduce((acc: any, curr: any) => {
        const date = new Date(curr.trnDate);

        // Ключ группировки зависит от диапазона
        let timeKey: string;
        if (currentRange === '24h') {
            timeKey = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // Для 3д, 7д и т.д. группируем по ДНЯМ или ЧАСАМ
            timeKey = date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
        }

        if (!acc[timeKey]) {
            acc[timeKey] = { time: timeKey, source: 0, destination: 0 };
        }

        const val = Number(curr.usdValue);

        // Если результат Number() — NaN, берем 0
        const safeVal = isNaN(val) ? 0 : val;

        if (curr.trnEventType === 'SOURCE') {
            acc[timeKey].source += safeVal;
        } else if (curr.trnEventType === 'DESTINATION') {
            val
            acc[timeKey].destination += safeVal;
        }

        return acc;
    }, {})

    const chartData = Object.values(formattedData)
    const totalVolume = chartData.reduce((sum: number, item: any) => {
        // Используем || 0, чтобы заменить NaN на ноль
        const source = Number(item.source) || 0;
        const dest = Number(item.destination) || 0;
        return sum + source + dest;
    }, 0);

    const cacheKey = JSON.stringify(resolvedSearchParams);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans" key={cacheKey}>
            <TopNavigation />
            
            <main className="max-w-7xl mx-auto px-8 py-8">
                <StatsGrid totalVolume={totalVolume} statLength={stats.length} currentRange={currentRange ? Array.isArray(currentRange) ? currentRange[0] : currentRange : '24h'} />
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <aside className="lg:col-span-1">
                        <Suspense fallback={<div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />}>
                            <FilterSidebar initialRange={currentRange} />
                        </Suspense>
                    </aside>


                    {/* Main Chart Area */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-slate-800">Volume Dynamics (per minute)</h3>
                                <div className="flex gap-2">
                                   <span
                                       className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                     <span className="w-2 h-2 bg-indigo-500 rounded-full"></span> Source
                                   </span>
                                </div>
                            </div>
                            <div className="h-[450px] w-full">
                                <DashboardWrapper initialData={chartData}/>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}