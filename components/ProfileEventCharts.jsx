import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const PIE_COLORS = ['#2563eb', '#94a3b8'];
const BAR_FILL = '#3b82f6';

export default function ProfileEventCharts({ eventSummaries, themeMode }) {
  const isDark = themeMode === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tooltipBg = isDark ? '#1e293b' : '#fff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';

  const total = eventSummaries?.total ?? 0;
  const upcoming = eventSummaries?.upcoming_count ?? 0;
  const past = eventSummaries?.past_count ?? 0;
  const byCategory = eventSummaries?.by_category || {};

  const categoryData = Object.entries(byCategory)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (total === 0) {
    return (
      <p style={{ color: axisColor, textAlign: 'center', padding: '2rem 1rem' }}>
        No plan events yet. Add events on the Plan page to see charts here.
      </p>
    );
  }

  let pieData;
  if (upcoming > 0 && past > 0) {
    pieData = [
      { name: 'Upcoming', value: upcoming },
      { name: 'Completed', value: past },
    ];
  } else if (upcoming > 0) {
    pieData = [{ name: 'Upcoming', value: upcoming }];
  } else if (past > 0) {
    pieData = [{ name: 'Completed', value: past }];
  } else {
    pieData = [{ name: 'Events', value: total }];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: isDark ? '#e2e8f0' : '#1e293b' }}>
          Upcoming vs completed
        </h4>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={88}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 8,
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {categoryData.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: isDark ? '#e2e8f0' : '#1e293b' }}>
            Events by category
          </h4>
          <div style={{ width: '100%', height: Math.min(360, 120 + categoryData.length * 36) }}>
            <ResponsiveContainer>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke={axisColor} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: axisColor, fontSize: 12 }}
                  stroke={axisColor}
                />
                <Tooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" name="Events" fill={BAR_FILL} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
