import { prisma } from '@/lib/prisma'
import { FilterSchema } from "@/lib/validations";
import DashboardWrapper from '@/components/DashboardWrapper'
import FilterSidebar from "@/components/FilterSidebar";
import { Suspense } from "react";
import TopNavigation from '@/components/TopNavigation';
import StatsGrid from '@/components/StatsGrid';
import { EVENT_TYPE_LABELS } from '@/lib/event-labels';

// turn on SSR for the page
export const dynamic = 'force-dynamic'

export function getPrismaWhere(rawParams: any) {
    const result = FilterSchema.safeParse(rawParams);

    const params = result.success ? result.data : FilterSchema.parse({});

    let startDate = new Date();
    let endDate: Date = params.dateTo ? new Date(`${params.dateTo}T23:59:59`) : new Date();

    if (params.range === 'custom' && params.dateFrom) {
        startDate = new Date(`${params.dateFrom}T00:00:00`);
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
        eventName: {
            in: params.eventName,
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
    
    // Group data
    const formattedData = stats.reduce((acc: any, curr: any) => {
        const date = new Date(curr.trnDate);

        // Group key depends from period
        let timeKey: string;
        if (currentRange === '24h') {
            timeKey = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // For 3d, 7d etc. group by DAYS OR HOURS
            timeKey = date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
        }

        if (!acc[timeKey]) {
            acc[timeKey] = { time: timeKey, source: 0, destination: 0 };
        }

        const val = Number(curr.usdValue);

        // If result Number() — NaN, use 0
        const safeVal = isNaN(val) ? 0 : val;

        if (curr.eventName === EVENT_TYPE_LABELS.OrderCreated) {
            acc[timeKey].source += safeVal;
        } else if (curr.eventName === EVENT_TYPE_LABELS.OrderFulfilled) {
            acc[timeKey].destination += safeVal;
        }

        return acc;
    }, {})
    const chartData = Object.values(formattedData)
    const totalVolume = chartData.reduce((sum: number, item: any) => {
        // Use || 0, to change NaN to 0
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
                                <h3 className="font-bold text-lg text-slate-800">
                                    Volume Dynamics
                                </h3>
                            </div>
                            <div className="w-full">
                                <DashboardWrapper initialData={chartData}/>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
