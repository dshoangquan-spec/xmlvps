
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { collectionGroup, query, where, getDocs, Timestamp, orderBy, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { InvoiceItem, User as CustomUser } from '@/types/firebase';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { vi } from 'date-fns/locale';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Loader2, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import KpiCards from './charts/kpi-cards';
import TopSuppliersTable from './charts/supplier-chart';
import InvoiceValueChart from './charts/invoice-value-chart';
import TopProductsTable from './charts/top-products-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface DashboardProps {
  currentUser: CustomUser; // Can be a real user or the "All Users" object
}

export type TopProductData = {
  code: string;
  name: string;
  unit: string;
  value: number;
  minPrice: number;
  maxPrice: number;
};

export type DashboardData = {
  totalRevenue: number;
  invoiceCount: number;
  supplierCount: number;
  avgOrderValue: number;
  supplierSpending: { name: string; value: number }[];
  invoiceValueDistribution: { range: string; count: number }[];
  topProducts: TopProductData[];
};

const ALL_USERS_ID = 'all_users_view';

export default function Dashboard({ currentUser }: DashboardProps) {
  const firestore = useFirestore();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const isAllUsersView = currentUser.id === ALL_USERS_ID;

  const fetchItems = useCallback(async (selectedDate: DateRange | undefined, user: CustomUser) => {
    if (!user?.id || !firestore || !selectedDate?.from || !selectedDate?.to) {
        setItems([]);
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);

    try {
      const fromDateStr = format(selectedDate.from, 'yyyy-MM-dd');
      const toDateStr = format(selectedDate.to, 'yyyy-MM-dd');

      let q;
      if (user.id === ALL_USERS_ID) {
        // Admin's "All Users" view: Use a collectionGroup query
        q = query(
          collectionGroup(firestore, 'items'),
          where('invoiceDateISO', '>=', fromDateStr),
          where('invoiceDateISO', '<=', toDateStr)
        );
      } else {
        // Single user view: collectionGroup query filtered by userId
        q = query(
          collectionGroup(firestore, 'items'),
          where('userId', '==', user.id),
          where('invoiceDateISO', '>=', fromDateStr),
          where('invoiceDateISO', '<=', toDateStr)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const fetchedItems = querySnapshot.docs.map(doc => doc.data() as InvoiceItem);
      setItems(fetchedItems);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);


  // Refetch when date range or the user being viewed changes
  useEffect(() => {
    fetchItems(date, currentUser);
  }, [date, currentUser, fetchItems]);
  
  const dashboardData = useMemo((): DashboardData | null => {
    if (items.length === 0) return null;

    const invoices = new Map<string, { sellerName: string; total: number }>();
    const supplierSpendingMap = new Map<string, number>();
    const topProductsMap = new Map<string, { code: string; name: string; unit: string; totalValue: number; prices: number[] }>();
    let totalRevenue = 0;

    items.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const taxRate = parseFloat(item.taxRate) / 100 || 0;
        
        const unitPriceWithVat = unitPrice * (1 + taxRate);
        const totalWithVat = quantity * unitPriceWithVat;
        totalRevenue += totalWithVat;

        // Create a unique invoice key combining user id and invoice id if in all users view
        const invoiceKey = isAllUsersView ? `${item.userId}-${item.invoiceId}` : item.invoiceId;

        if (!invoices.has(invoiceKey)) {
            invoices.set(invoiceKey, { sellerName: item.sellerName, total: 0 });
        }
        const currentInvoice = invoices.get(invoiceKey)!;
        currentInvoice.total += totalWithVat;

        supplierSpendingMap.set(item.sellerName, (supplierSpendingMap.get(item.sellerName) || 0) + totalWithVat);
        
        // Product analysis
        const productKey = item.itemCode; // Use itemCode as the unique key for a product
        if (!topProductsMap.has(productKey)) {
            topProductsMap.set(productKey, {
                code: item.itemCode,
                name: item.itemName,
                unit: item.unit,
                totalValue: 0,
                prices: [],
            });
        }
        const productData = topProductsMap.get(productKey)!;
        productData.totalValue += totalWithVat;
        if(unitPriceWithVat > 0) { // Only track non-zero prices
           productData.prices.push(unitPriceWithVat);
        }
    });

    const supplierSpending = Array.from(supplierSpendingMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topProducts: TopProductData[] = Array.from(topProductsMap.values())
      .map(p => ({
        code: p.code,
        name: p.name,
        unit: p.unit,
        value: p.totalValue,
        minPrice: p.prices.length > 0 ? Math.min(...p.prices) : 0,
        maxPrice: p.prices.length > 0 ? Math.max(...p.prices) : 0,
      }))
      .sort((a, b) => b.value - a.value); // We don't slice here anymore, let the component do it.

    const invoiceValues = Array.from(invoices.values()).map(inv => inv.total);
    const invoiceValueDistribution = [
      { range: '< 3M', count: invoiceValues.filter(v => v < 3000000).length },
      { range: '3-5M', count: invoiceValues.filter(v => v >= 3000000 && v < 5000000).length },
      { range: '5-10M', count: invoiceValues.filter(v => v >= 5000000 && v < 10000000).length },
      { range: '> 10M', count: invoiceValues.filter(v => v >= 10000000).length },
    ];
    
    return {
      totalRevenue,
      invoiceCount: invoices.size,
      supplierCount: supplierSpendingMap.size,
      avgOrderValue: invoices.size > 0 ? totalRevenue / invoices.size : 0,
      supplierSpending,
      invoiceValueDistribution,
      topProducts,
    };
  }, [items, isAllUsersView]);
  
  const presets = [
    { label: '7 ngày qua', range: { from: addDays(new Date(), -6), to: new Date() }},
    { label: '30 ngày qua', range: { from: addDays(new Date(), -29), to: new Date() }},
    { label: 'Tháng này', range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }},
    { label: 'Quý này', range: { from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }},
    { label: 'Năm nay', range: { from: new Date(new Date().getFullYear(), 0, 1), to: new Date(new Date().getFullYear(), 11, 31) }},
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight text-primary">
              Dashboard: {currentUser.fullName}
            </CardTitle>
            <CardDescription>
              {isAllUsersView ? "Tổng quan hoạt động nhập hàng của toàn bộ hệ thống." : `Tổng quan hoạt động nhập hàng của ${currentUser.fullName}.`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (date.to ? `${format(date.from, "dd/MM/yy")} - ${format(date.to, "dd/MM/yy")}` : format(date.from, "dd/MM/yy")) : <span>Chọn ngày</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex w-auto flex-col space-y-2 p-2" align="end">
                 <Select
                    onValueChange={(value) => {
                       const preset = presets.find(p => p.label === value);
                       if (preset) setDate(preset.range);
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Chọn nhanh..." />
                    </SelectTrigger>
                    <SelectContent position="popper">
                        {presets.map(preset => (
                             <SelectItem key={preset.label} value={preset.label}>{preset.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="rounded-md border">
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={vi} />
                </div>
              </PopoverContent>
            </Popover>
            {!isAllUsersView && (<Link href="/" passHref><Button variant="outline"><Home className="mr-2 h-4 w-4" />Trang chính</Button></Link>)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : !dashboardData ? (
          <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">Không có dữ liệu trong khoảng thời gian này.</p>
            <p className="text-sm text-muted-foreground">Hãy thử chọn một khoảng thời gian khác hoặc nhập thêm dữ liệu.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            <KpiCards data={dashboardData} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="col-span-1 lg:col-span-3">
                <TopSuppliersTable data={dashboardData.supplierSpending} />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <InvoiceValueChart data={dashboardData.invoiceValueDistribution} />
              </div>
            </div>
            <div>
              <TopProductsTable data={dashboardData.topProducts} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
