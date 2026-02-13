import { useMemo, useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, CartesianGrid } from 'recharts'
import { spendRepo } from '../../data/repositories/spendRepo'
import type { SpendEntry } from '../../data/models/types'
import { convertToBase, currencyToSymbol } from '../../lib/currency'
import { subDays, format, parseISO, startOfDay, isAfter } from 'date-fns'
import { usePreferences } from '../../shared/prefs/usePreferences'

const SpendChart = () => {
  const [entries, setEntries] = useState<SpendEntry[]>([])
  const { defaultCurrency } = usePreferences()

  useEffect(() => {
    spendRepo.listEntries().then(setEntries)
  }, [])

  const data = useMemo(() => {
    const days = 30
    const cutoff = startOfDay(subDays(new Date(), days))
    
    // Filter by date cutoff
    const filtered = entries.filter(e => {
       const date = parseISO(e.dateKey)
       return isAfter(date, cutoff)
    })

    const aggregated: Record<string, number> = {}
    
    // Fill all dates in range with 0 for continuity
    for (let i = 0; i < days; i++) {
        const d = subDays(new Date(), i)
        const key = format(d, 'yyyy-MM-dd')
        aggregated[key] = 0
    }

    filtered.forEach(entry => {
        const val = convertToBase(entry.amount, entry.currency, defaultCurrency)
        aggregated[entry.dateKey] = (aggregated[entry.dateKey] || 0) + val
    })

    return Object.entries(aggregated)
      .map(([date, amount]) => ({
        date,
        shortDate: format(parseISO(date), 'MM/dd'),
        amount
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [defaultCurrency, entries])

  const currencySymbol = currencyToSymbol(defaultCurrency)

  if (entries.length === 0) {
      return (
          <div className="h-[200px] flex items-center justify-center text-gray-400">
              No data available
          </div>
      )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end mb-4">
        <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">30D</span>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
            <XAxis 
                dataKey="shortDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                dy={10}
            />
            <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={(value) => `${currencySymbol}${Number(value).toFixed(2)}`}
            />
            <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default SpendChart
