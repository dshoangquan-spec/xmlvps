
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, getDocs, writeBatch, setDoc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import type { PharmacyAccount, User as CustomUser, FeeRecord } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, PlusCircle, Pencil, Trash2, Eye, EyeOff, Copy, CalendarIcon, Save, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, parse, isValid, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


interface AccountManagerProps {
  currentUser: CustomUser;
}

const emptyAccount: Omit<PharmacyAccount, 'id'> = {
  pharmacyName: "",
  representative: "",
  usageStartDate: '',
  softwareFee: 0,
  softwareFeeDate: '',
  pmName: "",
  pmUser: "",
  pmPass: "",
  invoiceProviderName: "",
  invoiceUser: "",
  invoicePass: "",
  invoiceLink: "",
  taxUser: "",
  taxPass: "",
  electronicTaxUser: "",
  electronicTaxPass: "",
  electronicTaxLink: "",
};

const ValueCell = ({ value, isPassword = false, isEditing, fieldKey, onValueChange, isUrl = false }: { value?: string, isPassword?: boolean, isEditing: boolean, fieldKey: string, onValueChange: (field: string, value: string) => void, isUrl?: boolean }) => {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast({ title: `Đã sao chép ${isPassword ? 'mật khẩu' : 'thông tin'}!` });
    }
  }
  
  if (isEditing) {
    return (
      <Input
          type={isUrl ? "url" : (isPassword && !visible ? "password" : "text")}
          value={value || ""}
          onChange={(e) => onValueChange(fieldKey, e.target.value)}
          className="h-8"
          autoFocus
        />
    )
  }

  if (!value) return <span className="text-muted-foreground/60 italic">trống</span>;

  return (
    <div className="flex items-center gap-1 group">
      <span className={cn("text-sm", isPassword && "font-mono tracking-wider", isUrl && "text-blue-600 underline")}>{isPassword && !visible ? '••••••••' : value}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
        {isPassword && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}


const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-3 items-center py-2 border-b">
        <strong className="text-sm text-muted-foreground col-span-1">{label}</strong>
        <div className="col-span-2">{children}</div>
    </div>
);

const fieldConfig: Array<{key: keyof Omit<PharmacyAccount, 'id'>, label: string, group: string, isPassword?: boolean, isUrl?: boolean}> = [
    { key: 'pharmacyName', label: 'Tên nhà thuốc', group: 'info' },
    { key: 'representative', label: 'Người đại diện', group: 'info' },
    { key: 'pmName', label: 'Tên PM', group: 'pm' },
    { key: 'pmUser', label: 'User PM', group: 'pm' },
    { key: 'pmPass', label: 'Pass PM', group: 'pm', isPassword: true },
    { key: 'invoiceProviderName', label: 'Tên HĐĐT', group: 'invoice' },
    { key: 'invoiceUser', label: 'User HĐĐT', group: 'invoice' },
    { key: 'invoicePass', label: 'Pass HĐĐT', group: 'invoice', isPassword: true },
    { key: 'invoiceLink', label: 'Link HĐĐT', group: 'invoice', isUrl: true },
    { key: 'taxUser', label: 'User Thuế', group: 'tax' },
    { key: 'taxPass', label: 'Pass Thuế', group: 'tax', isPassword: true },
    { key: 'electronicTaxUser', label: 'User Thuế ĐT', group: 'electronicTax' },
    { key: 'electronicTaxPass', label: 'Pass Thuế ĐT', group: 'electronicTax', isPassword: true },
    { key: 'electronicTaxLink', label: 'Link Thuế ĐT', group: 'electronicTax', isUrl: true },
];

const InfoGroup = ({ title, fields, accountData, setAccountData, isEditing, onSave, onCancel, onEdit }: { title: string, fields: typeof fieldConfig, accountData: PharmacyAccount, setAccountData: (data: PharmacyAccount) => void, isEditing: boolean, onSave: () => void, onCancel: () => void, onEdit: () => void }) => {
  
  const handleValueChange = (field: string, value: string) => {
    setAccountData({ ...accountData, [field]: value });
  };
  
  return (
    <div className="pt-4 space-y-1">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold">{title}</h4>
        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onSave}><Check className="h-4 w-4 mr-2 text-green-600"/>Lưu</Button>
              <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-2"/>Hủy</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-2"/>Chỉnh sửa</Button>
          )}
        </div>
      </div>
      {fields.map(field => (
        <InfoRow key={field.key} label={field.label}>
          <ValueCell 
            value={accountData[field.key] as string} 
            isPassword={field.isPassword}
            isUrl={field.isUrl}
            isEditing={isEditing}
            fieldKey={field.key}
            onValueChange={handleValueChange}
          />
        </InfoRow>
      ))}
    </div>
  )
}

const CostManager = ({ account, user }: { account: PharmacyAccount, user: CustomUser }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [accountData, setAccountData] = useState<Partial<PharmacyAccount>>({
      usageStartDate: account.usageStartDate,
      softwareFee: account.softwareFee,
      softwareFeeDate: account.softwareFeeDate
    });

    const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
    const [feeFormData, setFeeFormData] = useState<FeeRecord | null>(null);

    useEffect(() => {
        if (!firestore || !user.id || !account.id) {
          setFeeRecords([]);
          setIsLoading(false);
          return;
        };
        setIsLoading(true);
        const feeRecordsQuery = query(collection(firestore, 'users', user.id, 'pharmacy_accounts', account.id, 'fee_records'));
        
        const unsubscribe = onSnapshot(feeRecordsQuery, snapshot => {
            const records = snapshot.docs
                .map(doc => ({ ...doc.data() as FeeRecord, id: doc.id }))
                .sort((a, b) => b.month.localeCompare(a.month)); // Sort by month descending
            setFeeRecords(records);
            setIsLoading(false);
        }, error => {
            console.error("Error fetching fee records:", error);
            const permissionError = new FirestorePermissionError({ path: `users/${user.id}/pharmacy_accounts/${account.id}/fee_records`, operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user.id, account.id]);


    const handleAccountDataChange = (field: keyof PharmacyAccount, value: string | number | Date | undefined) => {
        setAccountData(prev => ({ ...prev, [field]: value }));
    };

    const handleFeeFormChange = (field: keyof FeeRecord, value: string | number | boolean) => {
        if (!feeFormData) return;
        
        let parsedValue = value;
        if (typeof value === 'string' && ['taxReportFee', 'invoiceImportFee', 'invoiceExportFee'].includes(field)) {
             const rawValue = value.replace(/\D/g, '');
             parsedValue = rawValue === '' ? 0 : parseFloat(rawValue);
        }

        const updatedRec = { ...feeFormData, [field]: parsedValue };
        
        if (field !== 'totalFee' && field !== 'isPaid' && field !== 'month') {
            updatedRec.totalFee = (Number(updatedRec.taxReportFee) || 0) + (Number(updatedRec.invoiceImportFee) || 0) + (Number(updatedRec.invoiceExportFee) || 0);
        }
        setFeeFormData(updatedRec);
    };

    const handleEditFee = (record: FeeRecord) => {
        setEditingFeeId(record.id);
        setFeeFormData(record);
    }
    const handleCancelEditFee = () => {
        setEditingFeeId(null);
        setFeeFormData(null);
    }
    
    const handleSaveFee = async () => {
        if (!feeFormData || !firestore) return;

        const feeRef = doc(firestore, 'users', user.id, 'pharmacy_accounts', account.id, 'fee_records', feeFormData.id);
        
        try {
            await setDoc(feeRef, feeFormData, { merge: true });
            toast({ title: 'Đã cập nhật dòng phí.' });
            handleCancelEditFee();
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: feeRef.path, operation: 'write', requestResourceData: feeFormData });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
    
    const handleAddNewMonth = () => {
        const lastRecordMonth = feeRecords.length > 0 ? parse(feeRecords[0].month, 'yyyy-MM', new Date()) : subMonths(new Date(), 1);
        const nextMonth = addMonths(lastRecordMonth, 1);
        const nextMonthId = format(nextMonth, 'yyyy-MM');
        
        if (feeRecords.some(r => r.id === nextMonthId)) {
            toast({ variant: 'destructive', title: `Tháng ${format(nextMonth, 'MM/yyyy')} đã tồn tại.`});
            return;
        };

        const newRecord: FeeRecord = {
            id: nextMonthId,
            month: nextMonthId,
            taxReportFee: 0,
            invoiceImportFee: 0,
            invoiceExportFee: 0,
            totalFee: 0,
            isPaid: false,
        };
        // This is a UI-only add, it will be saved on handleSaveFee
        setFeeRecords(prev => [newRecord, ...prev].sort((a,b) => b.month.localeCompare(a.month)));
        handleEditFee(newRecord);
    }
    
    const handleDeleteFeeRecord = async (id: string) => {
        if (!firestore) return;

        const originalFeeRecords = [...feeRecords];
        setFeeRecords(prev => prev.filter(rec => rec.id !== id));
        const feeRef = doc(firestore, 'users', user.id, 'pharmacy_accounts', account.id, 'fee_records', id);
        
        deleteDoc(feeRef).then(() => {
            toast({ title: 'Đã xóa dòng phí.' });
        }).catch(error => {
            const permissionError = new FirestorePermissionError({ path: feeRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
            setFeeRecords(originalFeeRecords); // Revert on error
        });
    };


    const handleSaveAll = async () => {
        if (!firestore) return;
        try {
            const batch = writeBatch(firestore);
            
            const accountRef = doc(firestore, 'users', user.id, 'pharmacy_accounts', account.id);
            const dataToUpdate: Partial<PharmacyAccount> = {};
            if (accountData.usageStartDate) dataToUpdate.usageStartDate = accountData.usageStartDate;
            const feeValue = typeof accountData.softwareFee === 'string' ? parseFloat(accountData.softwareFee.replace(/\./g, '')) : accountData.softwareFee;
            if (feeValue) dataToUpdate.softwareFee = Number(feeValue);
            if (accountData.softwareFeeDate) dataToUpdate.softwareFeeDate = accountData.softwareFeeDate;
            batch.update(accountRef, dataToUpdate);
            
            // Only save the currently edited row if it exists
            if (feeFormData && editingFeeId) {
                const feeRef = doc(firestore, 'users', user.id, 'pharmacy_accounts', account.id, 'fee_records', feeFormData.id);
                batch.set(feeRef, feeFormData, { merge: true });
            }

            await batch.commit();
            toast({ title: 'Đã lưu thay đổi!' });
            handleCancelEditFee();
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: `batch write to account and fee_records for user ${user.id}`,
                operation: 'write'
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
    
    const formatNumber = (num: number | undefined) => (num === undefined || num === null) ? '0' : num.toLocaleString('vi-VN');
    
    const usageDate = accountData.usageStartDate ? parse(accountData.usageStartDate, 'yyyy-MM-dd', new Date()) : undefined;
    const feeDate = accountData.softwareFeeDate ? parse(accountData.softwareFeeDate, 'yyyy-MM-dd', new Date()) : undefined;

    return (
        <div className="pt-4 space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Quản lý Chi phí & Dịch vụ</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4'>
                <div className="space-y-2">
                    <Label>Ngày bắt đầu sử dụng PM:</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !usageDate && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {usageDate ? format(usageDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={usageDate}
                            onSelect={(d) => handleAccountDataChange('usageStartDate', d ? format(d, 'yyyy-MM-dd') : '')}
                            initialFocus
                            locale={vi}
                        />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-2">
                    <Label>Ngày thu phí sử dụng PM:</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !feeDate && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {feeDate ? format(feeDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={feeDate}
                            onSelect={(d) => handleAccountDataChange('softwareFeeDate', d ? format(d, 'yyyy-MM-dd') : '')}
                            initialFocus
                            locale={vi}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                
                 <div className="space-y-2">
                    <Label>Số tiền thu (phí sử dụng PM):</Label>
                    <Input 
                        type="text" 
                        value={formatNumber(accountData.softwareFee)} 
                        onChange={e => {
                            const rawValue = e.target.value.replace(/\D/g, '');
                            handleAccountDataChange('softwareFee', rawValue === '' ? 0 : parseFloat(rawValue));
                        }} 
                        placeholder="Nhập số tiền..."
                        className="text-right"
                    />
                </div>
            </div>

            <div className="space-y-2 pt-4">
                <h4 className="font-semibold">Bảng theo dõi thu phí</h4>
                <div className="overflow-x-auto border rounded-md">
                    <Table>
                        <TableHeader className="bg-secondary">
                            <TableRow>
                                <TableHead className="w-[120px]">Tháng</TableHead>
                                <TableHead className="min-w-[150px] text-right">Phí BC Thuế</TableHead>
                                <TableHead className="min-w-[150px] text-right">Phí Nhập Hàng</TableHead>
                                <TableHead className="min-w-[150px] text-right">Phí Xuất Hàng</TableHead>
                                <TableHead className="min-w-[120px] text-right">Tổng Cộng</TableHead>
                                <TableHead className="text-center w-[80px]">Đã Thu</TableHead>
                                <TableHead className="text-center w-[100px]">Hành động</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                            ) : feeRecords.map(rec => {
                                const isEditing = editingFeeId === rec.id;
                                const currentData = isEditing && feeFormData ? feeFormData : rec;
                                
                                return (
                                <TableRow key={currentData.id} className={cn(isEditing && "bg-muted/50")}>
                                    <TableCell>
                                        <Input 
                                            type="text" 
                                            value={format(parse(currentData.month, 'yyyy-MM', new Date()), 'MM/yyyy')} 
                                            readOnly={!isEditing}
                                            onChange={() => {}}
                                            className={cn("h-8 w-24", !isEditing && "border-none bg-transparent")}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="text" value={formatNumber(currentData.taxReportFee)} readOnly={!isEditing} onChange={e => handleFeeFormChange('taxReportFee', e.target.value)} className={cn("h-8 text-right", !isEditing && "border-none bg-transparent")} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="text" value={formatNumber(currentData.invoiceImportFee)} readOnly={!isEditing} onChange={e => handleFeeFormChange('invoiceImportFee', e.target.value)} className={cn("h-8 text-right", !isEditing && "border-none bg-transparent")} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="text" value={formatNumber(currentData.invoiceExportFee)} readOnly={!isEditing} onChange={e => handleFeeFormChange('invoiceExportFee', e.target.value)} className={cn("h-8 text-right", !isEditing && "border-none bg-transparent")} />
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{formatNumber(currentData.totalFee)}</TableCell>
                                    <TableCell className="text-center">
                                      {isEditing ? (
                                          <Checkbox checked={currentData.isPaid} onCheckedChange={val => handleFeeFormChange('isPaid', val as boolean)} />
                                      ) : (
                                          currentData.isPaid ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                      )}
                                    </TableCell>
                                     <TableCell className="text-center">
                                        {isEditing ? (
                                            <div className="flex justify-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleSaveFee}><Check className="h-4 w-4"/></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelEditFee}><X className="h-4 w-4"/></Button>
                                            </div>
                                        ) : (
                                          <div className="flex justify-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditFee(rec)}><Pencil className="h-4 w-4"/></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Xóa dòng phí tháng {format(parse(rec.month, 'yyyy-MM', new Date()), 'MM/yyyy')}?</AlertDialogTitle>
                                                        <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteFeeRecord(rec.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <Button variant="outline" size="sm" onClick={handleAddNewMonth}><PlusCircle className="mr-2 h-4 w-4"/>Thêm tháng</Button>
                    <Button size="sm" onClick={handleSaveAll}><Save className="mr-2 h-4 w-4" />Lưu tất cả thay đổi</Button>
                </div>
            </div>
        </div>
    );
};


const AccountCard = ({ account, onDelete, currentUser }: { account: PharmacyAccount, onDelete: (id: string) => void, currentUser: CustomUser }) => {
    const firestore = useFirestore();
    const [editingTab, setEditingTab] = useState<string | null>(null);
    const [accountData, setAccountData] = useState(account);
    const { toast } = useToast();

    const handleSave = async (group: string) => {
        if (!firestore) return;

        const payload: Partial<PharmacyAccount> = {};
        fieldConfig.filter(f => f.group === group).forEach(f => {
            const key = f.key as keyof PharmacyAccount;
            if (key in accountData) {
                (payload as any)[key] = accountData[key];
            }
        });

        if (group === 'info') {
            payload.pharmacyName = accountData.pharmacyName;
            payload.representative = accountData.representative;
        }

        const docRef = doc(firestore, 'users', currentUser.id, 'pharmacy_accounts', account.id);
        
        updateDoc(docRef, payload).then(() => {
            toast({ title: "Đã cập nhật thông tin."});
            setEditingTab(null);
        }).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: payload
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };

    const handleCancel = () => {
        setAccountData(account);
        setEditingTab(null);
    };

    const renderInfoGroup = (groupKey: string, title: string) => {
        const groupFields = fieldConfig.filter(f => f.group === groupKey);
        return (
            <InfoGroup
                title={title}
                fields={groupFields}
                accountData={accountData}
                setAccountData={setAccountData}
                isEditing={editingTab === groupKey}
                onEdit={() => setEditingTab(groupKey)}
                onSave={() => handleSave(groupKey)}
                onCancel={handleCancel}
            />
        );
    };

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl font-bold text-primary">{account.pharmacyName}</CardTitle>
                        {account.representative && <CardDescription>{account.representative}</CardDescription>}
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" /> Xóa nhà thuốc
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận xóa tài khoản?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Hành động này sẽ xóa vĩnh viễn tài khoản của <span className='font-bold'>{account.pharmacyName}</span> và toàn bộ dữ liệu chi phí liên quan.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(account.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-6">
                 <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="info" disabled={editingTab !== null && editingTab !== 'info'}>Thông tin chung</TabsTrigger>
                        <TabsTrigger value="pm" disabled={editingTab !== null && editingTab !== 'pm'}>Phần mềm QL</TabsTrigger>
                        <TabsTrigger value="invoice" disabled={editingTab !== null && editingTab !== 'invoice'}>Hóa đơn điện tử của nhà mạng</TabsTrigger>
                        <TabsTrigger value="tax" disabled={editingTab !== null && editingTab !== 'tax'}>Thuế (hoadondientu.gdt.gov.vn)</TabsTrigger>
                        <TabsTrigger value="electronicTax" disabled={editingTab !== null && editingTab !== 'electronicTax'}>Thuế Điện tử</TabsTrigger>
                    </TabsList>
                    <TabsContent value="info">
                        {renderInfoGroup("info", "Thông tin chung")}
                    </TabsContent>
                    <TabsContent value="pm">
                         {renderInfoGroup("pm", "Tài khoản phần mềm quản lý")}
                    </TabsContent>
                    <TabsContent value="invoice">
                         {renderInfoGroup("invoice", "Tài khoản hóa đơn điện tử")}
                    </TabsContent>
                    <TabsContent value="tax">
                         {renderInfoGroup("tax", "Tài khoản thuế")}
                    </TabsContent>
                    <TabsContent value="electronicTax">
                         {renderInfoGroup("electronicTax", "Tài khoản thuế điện tử")}
                    </TabsContent>
                </Tabs>

                <Separator />
                
                <CostManager account={account} user={currentUser} />

            </CardContent>
        </Card>
    );
};

export default function AccountManager({ currentUser }: AccountManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [editingAccount, setEditingAccount] = useState<Partial<PharmacyAccount> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const accountsRef = useMemoFirebase(
    () => (currentUser?.id ? query(collection(firestore, 'users', currentUser.id, 'pharmacy_accounts'), orderBy('pharmacyName')) : null),
    [firestore, currentUser?.id]
  );
  const { data: accounts, isLoading: isLoadingAccounts } = useCollection<PharmacyAccount>(accountsRef);

  const handleOpenDialog = (account?: PharmacyAccount) => {
    setEditingAccount(account ? { ...account } : { ...emptyAccount });
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setEditingAccount(null);
    setIsDialogOpen(false);
  }

  const handleInputChange = (field: keyof Omit<PharmacyAccount, 'id'>, value: string) => {
    if (editingAccount) {
      setEditingAccount(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleSaveNew = async () => {
    if (!editingAccount || !editingAccount.pharmacyName) {
      toast({ variant: 'destructive', title: 'Thiếu thông tin', description: 'Tên nhà thuốc là bắt buộc.' });
      return;
    }
    if (!currentUser?.id) return;

    const collectionRef = collection(firestore, 'users', currentUser.id, 'pharmacy_accounts');
    
    addDoc(collectionRef, editingAccount)
      .then(() => {
        toast({ title: 'Thêm tài khoản thành công!' });
        handleCloseDialog();
      })
      .catch(error => {
        const permissionError = new FirestorePermissionError({
          path: collectionRef.path,
          operation: 'create',
          requestResourceData: editingAccount
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleDelete = async (accountId: string) => {
    if (!currentUser?.id || !firestore) return;

    try {
      const batch = writeBatch(firestore);
      const accountDocRef = doc(firestore, 'users', currentUser.id, 'pharmacy_accounts', accountId);
      
      const feeRecordsRef = collection(accountDocRef, 'fee_records');
      const feeRecordsSnapshot = await getDocs(feeRecordsRef);
      feeRecordsSnapshot.forEach(doc => batch.delete(doc.ref));

      const taxReportsRef = collection(accountDocRef, 'tax_reports');
      const taxReportsSnapshot = await getDocs(taxReportsRef);
      taxReportsSnapshot.forEach(doc => batch.delete(doc.ref));

      batch.delete(accountDocRef);

      await batch.commit();
      toast({ title: 'Đã xóa tài khoản và toàn bộ dữ liệu liên quan.' });
    } catch(e) {
        const permissionError = new FirestorePermissionError({
            path: `batch delete on account ${accountId}`,
            operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <div className="w-full">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm nhà thuốc mới</DialogTitle>
            <DialogDescription>
              Điền tên nhà thuốc. Các thông tin chi tiết khác bạn có thể cập nhật sau.
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <div className="py-4 space-y-4">
               <div className="space-y-2">
                   <Label htmlFor="pharmacyName">Tên nhà thuốc (*)</Label>
                   <Input id="pharmacyName" value={editingAccount.pharmacyName || ''} onChange={(e) => handleInputChange('pharmacyName', e.target.value)} />
               </div>
                <div className="space-y-2">
                   <Label htmlFor="representative">Người đại diện</Label>
                   <Input id="representative" value={editingAccount.representative || ''} onChange={(e) => handleInputChange('representative', e.target.value)} />
               </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Hủy</Button>
            <Button onClick={handleSaveNew}>Lưu thông tin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Quản lý tài khoản nhà thuốc</h1>
            <p className="text-muted-foreground">Thêm, sửa, xóa và xem thông tin các tài khoản của bạn.</p>
          </div>
           <div className='flex items-center gap-2'>
              <Button onClick={() => handleOpenDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Thêm tài khoản mới
              </Button>
              <Link href="/" passHref>
                  <Button variant="outline"><Home className="mr-2 h-4 w-4" /> Về trang chính</Button>
              </Link>
          </div>
        </div>

        {isLoadingAccounts ? (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : accounts && accounts.length > 0 ? (
            <div className="space-y-6">
                {accounts.map(acc => (
                    <AccountCard key={acc.id} account={acc} onDelete={handleDelete} currentUser={currentUser} />
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 border rounded-lg">
                <p>Chưa có tài khoản nào.</p>
                <p>Hãy thêm một tài khoản mới để bắt đầu quản lý.</p>
            </div>
        )}
    </div>
  );
}
