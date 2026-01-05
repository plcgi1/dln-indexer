"use client";
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useEffect, useState } from 'react';

export default function VolumeChart({ data }: { data: any[] }) {
    // console.info('data', data)
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    if (!isClient) return <div className="h-[450px] bg-slate-50 animate-pulse rounded-xl" />;
    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                let res = `${params[0].name}<br/>`;
                params.forEach((p: any) => {
                    // Выводим 9 знаков после запятой в тултипе
                    res += `${p.marker} ${p.seriesName}: <b>$${p.value.toFixed(9)}</b><br/>`;
                });
                return res;
            }
        },
        grid: {
            left: '5%',
            right: '5%',
            bottom: '15%', // Увеличь этот отступ, если шкала перекрывает даты
            top: '10%',
            containLabel: true
        },

        xAxis: {
            type: 'category',
            data: data.map(d => d.time),
            axisLabel: {
                hideOverlap: true,   // Прятать накладывающиеся подписи
                rotate: 30,          // Немного наклоним для лучшей читаемости
                fontSize: 10,
                color: '#94a3b8',
                interval: 'auto',    // ECharts сам решит, сколько меток пропустить, чтобы не было каши
                formatter: (value: string) => {
                    // Можно сократить слишком длинные названия месяцев если нужно
                    return value
                        .replace('января', 'янв').replace('февраля', 'фев');
                }
            },
            axisTick: {
                show: false // Уберем мелкие засечки для чистоты
            },
            axisLine: {
                lineStyle: { color: '#e2e8f0' }
            }
        },
        yAxis: [
            {
                // Ось для больших значений (Source)
                type: 'log', // или 'log'
                name: 'Source',
                scale: true,
                position: 'left',
                splitLine: { show: false }, // Убираем вторую сетку, чтобы не рябило
                axisLabel: {
                    formatter: (value: number) => value < 0.01 ? value.toExponential(1) : value.toFixed(2)
                }
            },
            {
                // Ось для микро-значений (Destination)
                type: 'log', // Логарифмическая шкала для лучшей видимости малых значений
                name: 'Destination',
                scale: true,
                position: 'right', // Выносим шкалу вправо
                splitLine: { show: false }, // Убираем вторую сетку, чтобы не рябило
                axisLabel: {
                    formatter: (value: number) => value < 0.01 ? value.toExponential(1) : value.toFixed(2)
                }
            }
        ],
        dataZoom: [
            {
                type: 'slider', // Этот тип создает видимую шкалу с ползунками внизу
                show: true,
                xAxisIndex: [0],
                start: 0,      // Процент начала (0%)
                end: 100,      // Процент конца (100%)
                bottom: 10,    // Отступ снизу
                height: 20,    // Высота самого ползунка
                borderColor: 'transparent',
                fillerColor: 'rgba(99, 102, 241, 0.1)', // Цвет выделенной области (Indigo)
                handleStyle: {
                    color: '#6366f1', // Цвет «ушек» ползунка
                },
                textStyle: {
                    color: '#64748b' // Цвет дат на шкале
                },

            },
            {
                type: 'inside', // Позволяет зумить график колесиком мыши или свайпом
                xAxisIndex: [0],
                start: 0,
                end: 100
            }
        ],
        series: [
   
            {
                name: 'Source',
                type: 'line',
                smooth: true,
                yAxisIndex: 0,
                showSymbol: false,
                data: data.map(d => d.source > 0 ? d.source : 1e-10),
                itemStyle: { color: '#6366f1' },
                areaStyle: { opacity: 0.1 }
            },
            {
                name: 'Destination',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                showSymbol: false,
                data: data.map(d => d.destination > 0 ? d.destination : 1e-10),
                itemStyle: { color: '#d9f163ff' },
                areaStyle: {
                    opacity: 0.2, // Увеличим прозрачность для лучшей видимости области
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(217, 241, 99, 0.5)' },
                        { offset: 1, color: 'rgba(217, 241, 99, 0)' }
                    ])
                }
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '500px' }} />;
}