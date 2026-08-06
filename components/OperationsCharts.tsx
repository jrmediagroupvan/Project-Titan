"use client";

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
} from "recharts";

export type OperationsChartPoint = {
  month: string;
  revenue: number;
  expenses: number;
  orders: number;
};

const cad = (value: number) => new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(value);

export default function OperationsCharts({ data, showExpenses }: {
  data: OperationsChartPoint[];
  showExpenses: boolean;
}) {
  return (
    <div className="dashboardCharts">
      <section className="card chartCard">
        <div><h2>Revenue and expenses</h2><p className="muted">Monthly operational totals for the last 12 months.</p></div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 12, left: 5, bottom: 0 }}>
            <CartesianGrid stroke="#22314a" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="#8fa3bf" tickLine={false} axisLine={false} />
            <YAxis stroke="#8fa3bf" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} />
            <Tooltip contentStyle={{ background: "#0d1b2f", border: "1px solid #2a3d5c", borderRadius: 10 }} formatter={(value) => cad(Number(value))} />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="Order revenue" stroke="#6d8cff" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            {showExpenses && <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f5a623" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />}
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="card chartCard">
        <div><h2>Orders by month</h2><p className="muted">Created orders across the same 12-month period.</p></div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#22314a" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" stroke="#8fa3bf" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="#8fa3bf" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#0d1b2f", border: "1px solid #2a3d5c", borderRadius: 10 }} />
            <Bar dataKey="orders" name="Orders" fill="#6d5dfc" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
