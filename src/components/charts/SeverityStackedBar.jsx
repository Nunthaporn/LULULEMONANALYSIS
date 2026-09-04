import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function SeverityStackedBar({ data = [], title = 'Severity split by theme' }) {
  return (
    <div>
      <div className="h-[420px]" aria-label={title} role="img">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={320}>
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 18, bottom: 6, left: 8 }}>
            <CartesianGrid stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#767676', fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="shortTheme"
              width={130}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#767676', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: 16,
              }}
            />
            <Legend />
            <Bar dataKey="oneStarImages" stackId="ratings" fill="#E20010" radius={[0, 0, 0, 0]} name="1-Star" isAnimationActive={false} />
            <Bar dataKey="twoStarImages" stackId="ratings" fill="#737373" name="2-Star" isAnimationActive={false} />
            <Bar dataKey="threeStarImages" stackId="ratings" fill="#d4d4d4" radius={[0, 12, 12, 0]} name="3-Star" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Theme</th>
            <th>1-Star Images</th>
            <th>2-Star Images</th>
            <th>3-Star Images</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.slug}>
              <td>{item.theme}</td>
              <td>{item.oneStarImages}</td>
              <td>{item.twoStarImages}</td>
              <td>{item.threeStarImages}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
