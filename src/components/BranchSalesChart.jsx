import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatPercent } from '../lib/metrics'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

// Horizontal bars so Thai branch names stay readable; data arrives sorted largest first.
// Value labels carry baht + share of total on wide screens, baht only on phones.
function BranchSalesChart({ data, colors }) {
  const isMobile = useIsMobile()
  const shareByBranch = Object.fromEntries(data.map((d) => [d.branch, d.share]))

  const renderLabel = ({ x, y, width, height, value, index }) => {
    const branch = data[index].branch
    return (
      <text x={x + width + 10} y={y + height / 2} dominantBaseline="central" fontSize={isMobile ? 12 : 13}>
        <tspan fill={colors.ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatBaht(value)}
        </tspan>
        {!isMobile && <tspan fill={colors.muted}>{`  ·  ${formatPercent(shareByBranch[branch])}`}</tspan>}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * (isMobile ? 44 : 54))}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: isMobile ? 80 : 150, bottom: 0, left: 0 }}
        barCategoryGap={isMobile ? 12 : 14}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="branch"
          tick={{ fontSize: isMobile ? 12 : 14, fill: colors.ink2 }}
          tickLine={false}
          axisLine={false}
          width={isMobile ? 78 : 104}
        />
        <Tooltip
          cursor={{ fill: colors.surface2 }}
          content={<ChartTooltip series={{ sales: { name: 'ยอดขาย', color: colors.accent } }} />}
        />
        <Bar dataKey="sales" fill={colors.accent} radius={[0, 6, 6, 0]} isAnimationActive={false}>
          <LabelList dataKey="sales" content={renderLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default BranchSalesChart
