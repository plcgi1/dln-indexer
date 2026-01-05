import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const minUsd = searchParams.get("minUsd") || "0";

    const stats = await prisma.trnLog.groupBy({
        by: ['trnDate', 'trnEventType'],
        where: {
            trnDate: {
                gte: from ? new Date(from) : undefined,
                lte: to ? new Date(to) : undefined,
            },
            usdValue: {
                gte: parseFloat(minUsd)
            }
        },
        _sum: { usdValue: true },
        orderBy: { trnDate: 'asc' }
    });

    const formatted = stats.reduce((acc: any, curr: any) => {
        const d = curr.trnDate.toISOString().split('T')[0];
        if (!acc[d]) acc[d] = { date: d, created: 0, fulfilled: 0 };
        const val = Number(curr._sum.usdValue || 0);
        if (curr.trnEventType.toLowerCase().includes('create')) acc[d].created += val;
        else acc[d].fulfilled += val;
        return acc;
    }, {});

    return NextResponse.json(Object.values(formatted));
}