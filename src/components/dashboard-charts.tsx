"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ScorePoint {
  label: string;
  score: number;
  percentage: number;
}

interface MasteryPoint {
  name: string;
  mastery: number;
  classification: string;
}

interface WeakPoint {
  name: string;
  mastery: number;
  answers: number;
}

const COLORS = ["#2563eb", "#12b76a", "#f79009", "#f04438", "#0891b2", "#64748b"];

export function PerformanceChart({ data }: { data: ScorePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#667085]">
        No submitted diagnostics yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#667085" }} />
        <YAxis tick={{ fontSize: 11, fill: "#667085" }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #eaecf0",
            borderRadius: "12px",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="percentage"
          stroke="#2563eb"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorScore)"
          animationDuration={1200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MasteryDistributionChart({ data }: { data: MasteryPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#667085]">
        No mastery data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#667085" }} angle={-45} textAnchor="end" height={80} />
        <YAxis tick={{ fontSize: 11, fill: "#667085" }} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #eaecf0",
            borderRadius: "12px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="mastery" radius={[8, 8, 0, 0]} animationDuration={1000}>
          {data.map((entry, index) => {
            const color =
              entry.classification === "strong"
                ? "#12b76a"
                : entry.classification === "developing"
                  ? "#f79009"
                  : entry.classification === "weak"
                    ? "#f04438"
                    : "#98a2b3";
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeakTopicsChart({ data }: { data: WeakPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#667085]">
        Great! No weak topics
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#667085" }} domain={[0, 100]} />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 11, fill: "#667085" }}
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #eaecf0",
            borderRadius: "12px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="mastery" fill="#f04438" radius={[0, 8, 8, 0]} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OverallStatusChart({
  weak,
  developing,
  strong,
  notAssessed,
}: {
  weak: number;
  developing: number;
  strong: number;
  notAssessed: number;
}) {
  const data = [
    { name: "Strong", value: strong },
    { name: "Developing", value: developing },
    { name: "Weak", value: weak },
    { name: "Not Assessed", value: notAssessed },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#667085]">
        No topics yet
      </div>
    );
  }

  const pieColors = ["#12b76a", "#f79009", "#f04438", "#98a2b3"];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          animationDuration={1000}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #eaecf0",
            borderRadius: "12px",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
