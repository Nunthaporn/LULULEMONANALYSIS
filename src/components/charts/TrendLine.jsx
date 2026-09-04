import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function TrendLine({
  data = [],
  type = 'line',
  xKey = 'label',
  lines = [],
  areas = [],
  title = 'Trend chart',
  showBrush = false,
}) {
  const ChartComponent = type === 'area' ? AreaChart : LineChart

  return (
    <div>
      <div className="h-[340px]" aria-label={title} role="img">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={260}>
          <ChartComponent data={data} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fill: '#767676', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#767676', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: 16,
              }}
            />
            <Legend />
            {areas.map((area) => (
              <Area
                key={area.dataKey}
                type="monotone"
                dataKey={area.dataKey}
                name={area.name || area.dataKey}
                stackId={area.stackId || 'stack'}
                stroke={area.stroke}
                fill={area.fill}
                fillOpacity={0.9}
                isAnimationActive={false}
              />
            ))}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.stroke}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
            {showBrush ? <Brush dataKey={xKey} height={26} stroke="#E20010" /> : null}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{xKey}</th>
            {lines.map((line) => (
              <th key={line.dataKey}>{line.dataKey}</th>
            ))}
            {areas.map((area) => (
              <th key={area.dataKey}>{area.dataKey}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row[xKey]}-${index}`}>
              <td>{row[xKey]}</td>
              {lines.map((line) => (
                <td key={line.dataKey}>{row[line.dataKey]}</td>
              ))}
              {areas.map((area) => (
                <td key={area.dataKey}>{row[area.dataKey]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
