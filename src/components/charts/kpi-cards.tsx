'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DollarSign, FileText, Truck, Scale } from 'lucide-react';
import type { DashboardData } from '../dashboard';

interface KpiCardsProps {
  data: DashboardData;
}

const formatNumber = (num: number, isCurrency = true) => {
  if (isCurrency) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  }
  return new Intl.NumberFormat('vi-VN').format(num);
};

export default function KpiCards({ data }: KpiCardsProps) {
  const kpis = [
    {
      title: 'Tổng giá trị đã nhập',
      value: formatNumber(data.totalRevenue),
      icon: DollarSign,
    },
    {
      title: 'Tổng số hóa đơn',
      value: formatNumber(data.invoiceCount, false),
      icon: FileText,
    },
    {
      title: 'Số nhà cung cấp',
      value: formatNumber(data.supplierCount, false),
      icon: Truck,
    },
    {
      title: 'Giá trị TB/hóa đơn',
      value: formatNumber(data.avgOrderValue),
      icon: Scale,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            <kpi.icon className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
