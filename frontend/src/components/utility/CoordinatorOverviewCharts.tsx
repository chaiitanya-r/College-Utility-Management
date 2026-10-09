import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DailyPoint {
  date: string;
  bookings: number;
  confirmed: number;
  pending: number;
}

interface UtilityPoint {
  name: string;
  total: number;
  confirmed: number;
  pending: number;
}

export const DailyBookingsChart = ({ data }: { data: DailyPoint[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="bookings" stroke="#8884d8" name="Total Bookings" />
      <Line type="monotone" dataKey="confirmed" stroke="#82ca9d" name="Confirmed" />
      <Line type="monotone" dataKey="pending" stroke="#ffc658" name="Pending" />
    </LineChart>
  </ResponsiveContainer>
);

export const UtilityBookingsChart = ({ data }: { data: UtilityPoint[] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="total" fill="#8884d8" name="Total" />
      <Bar dataKey="confirmed" fill="#82ca9d" name="Confirmed" />
      <Bar dataKey="pending" fill="#ffc658" name="Pending" />
    </BarChart>
  </ResponsiveContainer>
);
