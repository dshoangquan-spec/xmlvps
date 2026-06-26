
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import type { User as CustomUser, PharmacyAccount, TaxReport, FeeRecord } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Home, Loader2, Save, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, writeBatch, getDoc, deleteDoc, where, onSnapshot, DocumentReference } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getYear, getQuarter, subQuarters, format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface TaxReportManagerProps {
    currentUser: CustomUser;
}

const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
}

const parseNumber = (str: string | number | undefined | null): number => {
    if (str === null || str === undefined) return 0;
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    const cleanedString = String(str).replace(/\./g, '');
    return parseFloat(cleanedString.replace(/[^\d-]/g, '')) || 0;
}


export default function TaxReportManager({ currentUser }: TaxReportManagerProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [selectedQuarter, setSelectedQuarter] = useState<string>(() => String(getQuarter(new Date())));
    const [selectedYear, setSelectedYear] = useState<string>(() => String(getYear(new Date())));

    // State for report data
    const [openingBalance, setOpeningBalance] = useState(0);
    const [revenue, setRevenue] = useState(0); // Bán ra
    const [costOfGoods, setCostOfGoods] = useState(0); // Giá vốn
    const [purchaseValue, setPurchaseValue] = useState(0); // Mua vào
    
    // State for fee calculation
    const [taxReportFee, setTaxReportFee] = useState(0);
    const [invoiceImportFee, setInvoiceImportFee] = useState(0);
    const [invoiceExportFee, setInvoiceExportFee] = useState(0);


    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingPrevious, setIsFetchingPrevious] = useState(false);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);

    const [reportHistory, setReportHistory] = useState<TaxReport[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);


    const isAdmin = currentUser.role === 'ADMIN';

    // Derived values
    const closingBalance = useMemo(() => parseNumber(openingBalance) + parseNumber(purchaseValue) - parseNumber(revenue), [openingBalance, purchaseValue, revenue]);
    const vatPayable = useMemo(() => parseNumber(revenue) * 0.01, [revenue]);
    const pitPayable = useMemo(() => parseNumber(revenue) * 0.005, [revenue]);
    const totalTaxPayable = useMemo(() => parseNumber(vatPayable) + parseNumber(pitPayable), [vatPayable, pitPayable]);
    const totalFee = useMemo(() => parseNumber(taxReportFee) + parseNumber(invoiceImportFee) + parseNumber(invoiceExportFee), [taxReportFee, invoiceImportFee, invoiceExportFee]);

    
    // Fetch all users if admin
    const usersRef = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'users'), orderBy('fullName')) : null, [isAdmin, firestore]);
    const { data: allUsers, isLoading: isLoadingUsers } = useCollection<CustomUser>(usersRef);

    // Fetch pharmacy accounts for the selected user
    const accountsRef = useMemoFirebase(
        () => (selectedUserId ? query(collection(firestore, 'users', selectedUserId, 'pharmacy_accounts'), orderBy('pharmacyName')) : null),
        [firestore, selectedUserId]
    );
    const { data: pharmacyAccounts, isLoading: isLoadingAccounts } = useCollection<PharmacyAccount>(accountsRef);

    // Fetch tax report history for the selected account
    useEffect(() => {
      if (!selectedAccount || !firestore || !selectedUserId) {
        setReportHistory([]);
        setIsLoadingHistory(false);
        return;
      }
      setIsLoadingHistory(true);
      const q = collection(
        firestore,
        'users',
        selectedUserId,
        'pharmacy_accounts',
        selectedAccount,
        'tax_reports'
      );

      const unsubscribe = onSnapshot(q, snap => {
        const history = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as TaxReport))
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.quarter - a.quarter;
          });
      
        setReportHistory(history);
        setIsLoadingHistory(false);
      }, (error) => {
        console.error("Error fetching tax report history: ", error);
        setReportHistory([]);
        setIsLoadingHistory(false);
        toast({
            variant: "destructive",
            title: "Lỗi tải lịch sử báo cáo",
            description: "Không thể tải dữ liệu lịch sử cho nhà thuốc này."
        });
      });

      return () => unsubscribe();
    }, [selectedUserId, selectedAccount, firestore, toast]);

    // Fetch existing tax report data
    const reportId = useMemo(() => 
        selectedAccount ? `${selectedYear}-Q${selectedQuarter}` : null
    , [selectedAccount, selectedYear, selectedQuarter]);
    
    const reportRef = useMemoFirebase<DocumentReference | null>(() => 
      (selectedUserId && selectedAccount && reportId) ? doc(firestore, 'users', selectedUserId, 'pharmacy_accounts', selectedAccount, 'tax_reports', reportId) : null,
    [selectedUserId, selectedAccount, reportId, firestore]);
    const { data: existingReport, isLoading: isLoadingReport } = useDoc<TaxReport>(reportRef);
    
    // Fetch previous quarter's report for opening balance
    useEffect(() => {
        if (!selectedAccount || !selectedYear || !selectedQuarter || !firestore) {
            setOpeningBalance(0);
            return;
        }

        // If we are editing an existing report, use its opening balance
        if (existingReport && existingReport.id === reportId) {
            setOpeningBalance(existingReport.openingBalance || 0);
            return;
        }

        const fetchPreviousReport = async () => {
            setIsFetchingPrevious(true);
            const currentPeriod = new Date(Number(selectedYear), (Number(selectedQuarter) - 1) * 3);
            const previousPeriod = subQuarters(currentPeriod, 1);
            const prevYear = getYear(previousPeriod);
            const prevQuarter = getQuarter(previousPeriod);
            
            const prevReportId = `${prevYear}-Q${prevQuarter}`;
            const prevReportRef = doc(firestore, 'users', selectedUserId, 'pharmacy_accounts', selectedAccount, 'tax_reports', prevReportId);

            try {
                const prevReportSnap = await getDoc(prevReportRef);
                if (prevReportSnap.exists()) {
                    const prevReportData = prevReportSnap.data() as TaxReport;
                    setOpeningBalance(prevReportData.closingBalance || 0);
                } else {
                    setOpeningBalance(0); // Reset if no previous report
                }
            } catch (error) {
                 const permissionError = new FirestorePermissionError({
                    path: prevReportRef.path,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
                setOpeningBalance(0);
            } finally {
                setIsFetchingPrevious(false);
            }
        };

        fetchPreviousReport();

    }, [selectedAccount, selectedUserId, selectedYear, selectedQuarter, firestore, existingReport, reportId]);


    // Update state when an existing report is loaded
    useEffect(() => {
        if (existingReport && existingReport.id === reportId) {
            setRevenue(existingReport.revenue);
            setPurchaseValue(existingReport.purchaseValue); 
            setCostOfGoods(existingReport.costOfGoods);
            setCurrentReportId(existingReport.id);
        } else {
            // Reset fields when changing selection if no report exists
            setRevenue(0);
            setPurchaseValue(0);
            setCostOfGoods(0);
            setCurrentReportId(null);
        }
    }, [existingReport, reportId]);


    const handleUserChange = (userId: string) => {
        setSelectedUserId(userId);
        setSelectedAccount(null); // Reset account selection
    };

    const handleEditReport = (report: TaxReport) => {
      setSelectedYear(String(report.year));
      setSelectedQuarter(String(report.quarter));
    };

    const handleDeleteReport = (reportToDelete: TaxReport) => {
        if (!reportToDelete || !firestore || !selectedAccount) return;

        const reportDocRef = doc(firestore, 'users', selectedUserId, 'pharmacy_accounts', selectedAccount, 'tax_reports', reportToDelete.id);
        
        deleteDoc(reportDocRef).then(() => {
            toast({ title: 'Thành công', description: `Đã xóa báo cáo Quý ${reportToDelete.quarter}/${reportToDelete.year}.`});
        }).catch(() => {
             const permissionError = new FirestorePermissionError({
                path: reportDocRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };


    const handleSubmit = async () => {
        if (!reportId || !selectedAccount) {
            toast({ variant: 'destructive', title: 'Vui lòng chọn nhà thuốc.' });
            return;
        }
        setIsSubmitting(true);

        const reportData: TaxReport = {
            id: reportId,
            pharmacyAccountId: selectedAccount,
            userId: selectedUserId,
            year: Number(selectedYear),
            quarter: Number(selectedQuarter),
            openingBalance: parseNumber(openingBalance),
            purchaseValue: parseNumber(purchaseValue),
            revenue: parseNumber(revenue),
            costOfGoods: parseNumber(costOfGoods),
            closingBalance: parseNumber(closingBalance),
            vatPayable: parseNumber(vatPayable),
            pitPayable: parseNumber(pitPayable),
            status: 'DRAFT',
            createdAt: existingReport?.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const reportDocRef = doc(firestore, 'users', selectedUserId, 'pharmacy_accounts', selectedAccount, 'tax_reports', reportId);
        
        setDoc(reportDocRef, reportData, { merge: true }).then(() => {
            toast({ title: 'Thành công', description: 'Đã lưu báo cáo thuế.' });
        }).catch((error) => {
            const permissionError = new FirestorePermissionError({
                path: reportDocRef.path,
                operation: 'write',
                requestResourceData: reportData
            });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            setIsSubmitting(false);
        });
    };
    
    const handleNumberInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(parseNumber(e.target.value));
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Báo cáo Thuế theo Quý</h1>
                    <p className="text-muted-foreground">Nhập và tính toán số liệu thuế cho từng nhà thuốc.</p>
                </div>
                 <Link href="/" passHref>
                    <Button variant="outline"><Home className="mr-2 h-4 w-4" /> Về trang chính</Button>
                </Link>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Chọn kỳ báo cáo và nhà thuốc</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {isAdmin && (
                         <div className="space-y-2">
                            <Label htmlFor="user-select">Người dùng</Label>
                            {isLoadingUsers ? <Loader2 className="animate-spin"/> : (
                                <Select onValueChange={handleUserChange} value={selectedUserId}>
                                    <SelectTrigger id="user-select">
                                        <SelectValue placeholder="Chọn người dùng..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allUsers?.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="account-select">Nhà thuốc</Label>
                         {isLoadingAccounts ? <Loader2 className="animate-spin"/> : (
                             <Select onValueChange={setSelectedAccount} value={selectedAccount || ''} disabled={!selectedUserId}>
                                <SelectTrigger id="account-select">
                                    <SelectValue placeholder="Chọn nhà thuốc..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {pharmacyAccounts?.length ? pharmacyAccounts?.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.pharmacyName}</SelectItem>
                                    )) : <div className="p-4 text-sm text-muted-foreground">Chưa có nhà thuốc.</div>}
                                </SelectContent>
                            </Select>
                         )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quarter-select">Quý</Label>
                         <Select onValueChange={setSelectedQuarter} value={selectedQuarter}>
                            <SelectTrigger id="quarter-select">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Quý 1</SelectItem>
                                <SelectItem value="2">Quý 2</SelectItem>
                                <SelectItem value="3">Quý 3</SelectItem>
                                <SelectItem value="4">Quý 4</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="year-select">Năm</Label>
                        <Input 
                            id="year-select"
                            type="number"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className={!selectedAccount ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader>
                    <CardTitle>2. Kê khai và tính toán</CardTitle>
                    <CardDescription className="text-lg font-bold text-destructive">
                        {selectedAccount ? `Báo cáo cho Quý ${selectedQuarter}/${selectedYear}` : "Vui lòng chọn nhà thuốc để bắt đầu."}
                    </CardDescription>
                </CardHeader>
                 <CardContent className="space-y-8">
                     {isLoadingReport || isFetchingPrevious ? <div className="flex justify-center"><Loader2 className="animate-spin" /></div> : (
                        <>
                         {/* Part I */}
                         <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">I. Tình hình hoạt động kinh doanh</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                                <div className="space-y-2">
                                    <Label>Tồn đầu kỳ</Label>
                                    <Input value={formatNumber(openingBalance)} readOnly className="font-semibold text-lg h-12 text-right bg-muted" />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="purchaseValue">Mua vào</Label>
                                    <Input id="purchaseValue" value={formatNumber(purchaseValue)} onChange={handleNumberInputChange(setPurchaseValue)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="revenue">Bán ra (Doanh thu)</Label>
                                    <Input id="revenue" value={formatNumber(revenue)} onChange={handleNumberInputChange(setRevenue)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tồn cuối kỳ</Label>
                                    <Input value={formatNumber(closingBalance)} readOnly className="font-semibold text-lg h-12 text-right bg-muted" />
                                </div>
                                <div className="space-y-2 col-span-2 md:col-span-4">
                                    <Label htmlFor="cost">Giá vốn hàng bán (đã rà soát)</Label>
                                    <Input id="cost" value={formatNumber(costOfGoods)} onChange={handleNumberInputChange(setCostOfGoods)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                            </div>
                         </div>
                         {/* Part II */}
                         <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">II. Số tiền nộp thuế</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                                <div className="space-y-2">
                                    <Label>Thuế GTGT phải nộp (1%)</Label>
                                    <Input value={formatNumber(vatPayable)} readOnly className="font-semibold text-lg h-12 text-right bg-muted" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Thuế TNCN phải nộp (0.5%)</Label>
                                    <Input value={formatNumber(pitPayable)} readOnly className="font-semibold text-lg h-12 text-right bg-muted" />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Tổng cộng</Label>
                                    <Input value={formatNumber(totalTaxPayable)} readOnly className="font-semibold text-lg h-12 text-right bg-primary/10 text-primary" />
                                </div>
                             </div>
                         </div>
                         {/* Part III */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">III. Thu phí dịch vụ</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="taxReportFee">Phí báo cáo thuế</Label>
                                    <Input id="taxReportFee" value={formatNumber(taxReportFee)} onChange={handleNumberInputChange(setTaxReportFee)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="invoiceImportFee">Phí nhập liệu</Label>
                                    <Input id="invoiceImportFee" value={formatNumber(invoiceImportFee)} onChange={handleNumberInputChange(setInvoiceImportFee)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="invoiceExportFee">Phí xuất báo cáo</Label>
                                    <Input id="invoiceExportFee" value={formatNumber(invoiceExportFee)} onChange={handleNumberInputChange(setInvoiceExportFee)} className="font-semibold text-lg h-12 text-right" />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Tổng phí dịch vụ</Label>
                                    <Input value={formatNumber(totalFee)} readOnly className="font-semibold text-lg h-12 text-right bg-muted" />
                                </div>
                            </div>
                        </div>
                        </>
                     )}
                </CardContent>
                 <CardFooter>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Lưu báo cáo
                    </Button>
                </CardFooter>
            </Card>
            
            {/* History Table */}
            {selectedAccount && (
            <Card>
                <CardHeader>
                    <CardTitle>Lịch sử Báo cáo Thuế</CardTitle>
                    <CardDescription>Các báo cáo đã được lưu cho nhà thuốc này.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Kỳ BC</TableHead>
                                    <TableHead className="text-right">Tồn đầu kỳ</TableHead>
                                    <TableHead className="text-right">Mua vào</TableHead>
                                    <TableHead className="text-right">Doanh thu</TableHead>
                                    <TableHead className="text-right">Giá vốn</TableHead>
                                    <TableHead className="text-right">Tồn cuối kỳ</TableHead>
                                    <TableHead className="text-right">VAT (1%)</TableHead>
                                    <TableHead className="text-right">TNCN (0.5%)</TableHead>
                                    <TableHead className="text-center w-[120px]">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : reportHistory && reportHistory.length > 0 ? (
                                    reportHistory.map(report => (
                                        <TableRow key={report.id} className={report.id === currentReportId ? "bg-muted" : ""}>
                                            <TableCell className="font-medium">{`Q${report.quarter}/${report.year}`}</TableCell>
                                            <TableCell className="text-right">{formatNumber(report.openingBalance)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(report.purchaseValue)}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatNumber(report.revenue)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(report.costOfGoods)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(report.closingBalance)}</TableCell>
                                            <TableCell className="text-right text-red-600">{formatNumber(report.vatPayable)}</TableCell>
                                            <TableCell className="text-right text-red-600">{formatNumber(report.pitPayable)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditReport(report)} title="Xem lại & Sửa">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Xóa">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Xác nhận xóa báo cáo?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Bạn có chắc muốn xóa báo cáo của <span className="font-bold">{`Quý ${report.quarter}/${report.year}`}</span>? Hành động này không thể hoàn tác.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteReport(report)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            Chưa có báo cáo nào cho nhà thuốc này.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            )}

        </div>
    )
}
