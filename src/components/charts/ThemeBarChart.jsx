import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function ThemeValueLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value,
  index,
  data = [],
  percentageKey,
}) {
  const item = data[index]
  if (!item) {
    return null
  }

  const percentage = Number(item[percentageKey] || 0).toFixed(1)

  return (
    <text x={x + width + 8} y={y + height / 2} dy={4} fill="#4a4a4a" fontSize="12">
      {`${value} | ${percentage}%`}
    </text>
  )
}

export default function ThemeBarChart({
  data = [],
  dataKey = 'totalReviewsWithImages',
  percentageKey = 'overallShare',
  title = 'Theme chart',
}) {
  return (
    <div>
      <div className="h-[360px]" aria-label={title} role="img">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={280}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 6, right: 104, bottom: 6, left: 28 }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767676', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="shortTheme"
              width={178}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767676', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, _name, item) => [
                `${value} reviews | ${Number(item?.payload?.[percentageKey] || 0).toFixed(1)}%`,
                'Low-star reviews',
              ]}
              cursor={{ fill: 'rgba(226, 0, 16, 0.06)' }}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: 16,
              }}
            />
            <Bar dataKey={dataKey} radius={[0, 12, 12, 0]} isAnimationActive={false}>
              <LabelList
                dataKey={dataKey}
                content={(props) => (
                  <ThemeValueLabel {...props} data={data} percentageKey={percentageKey} />
                )}
              />
              {data.map((entry) => (
                <Cell key={entry.slug} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Theme</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.slug}>
              <td>{item.theme}</td>
              <td>{item[dataKey]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
