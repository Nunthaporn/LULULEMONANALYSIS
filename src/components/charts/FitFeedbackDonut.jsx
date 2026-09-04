import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export default function FitFeedbackDonut({ data = [], title = 'Fit feedback breakdown' }) {
  return (
    <div>
      <div className="h-[320px]" aria-label={title} role="img">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={74}
              outerRadius={110}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: 16,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Fit feedback</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
