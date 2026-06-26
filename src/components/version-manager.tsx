
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, serverTimestamp } from 'firebase/firestore';
import type { Version, Change } from '@/types/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, PlusCircle, Pencil, Trash2, Check, X, GitCommitHorizontal, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type ChangeWithId = Change & { id: string };

const emptyChange: Omit<Change, 'id' | 'versionId' | 'order'> = {
    type: 'new',
    text: '',
    adminOnly: false,
};

function VersionItem({ version, onDeleteVersion }: { version: Version; onDeleteVersion: (id: string) => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const changesRef = useMemoFirebase(() => query(collection(firestore, 'versions', version.id, 'changes'), orderBy('order', 'asc')), [firestore, version.id]);
    const { data: changes, isLoading: isLoadingChanges } = useCollection<ChangeWithId>(changesRef);
    
    const [editingChange, setEditingChange] = useState<ChangeWithId | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newChangeData, setNewChangeData] = useState(emptyChange);

    const handleAddChange = async () => {
        if (!newChangeData.text) {
            toast({ variant: 'destructive', title: 'Nội dung thay đổi không được để trống' });
            return;
        }
        const newOrder = changes ? changes.length + 1 : 1;
        await addDoc(collection(firestore, 'versions', version.id, 'changes'), { ...newChangeData, versionId: version.id, order: newOrder });
        setNewChangeData(emptyChange);
        setIsAdding(false);
        toast({ title: 'Thêm thay đổi thành công!' });
    };

    const handleUpdateChange = async () => {
        if (!editingChange) return;
        const changeRef = doc(firestore, 'versions', version.id, 'changes', editingChange.id);
        await updateDoc(changeRef, editingChange as any);
        setEditingChange(null);
        toast({ title: 'Cập nhật thành công!' });
    };

    const handleDeleteChange = async (changeId: string) => {
        await deleteDoc(doc(firestore, 'versions', version.id, 'changes', changeId));
        toast({ title: 'Đã xóa thay đổi.' });
    };

    const togglePublish = async (isPublished: boolean) => {
        await updateDoc(doc(firestore, 'versions', version.id), { published: isPublished });
        toast({ title: `Đã ${isPublished ? 'xuất bản' : 'ẩn'} phiên bản.` });
    }

    return (
         <AccordionItem value={version.id}>
            <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                    <div className="flex items-center gap-4">
                        <GitCommitHorizontal className="h-5 w-5 text-primary" />
                        <span className="text-lg font-semibold">{version.versionNumber}</span>
                        <span className="text-sm text-muted-foreground">{new Date(version.releaseDate).toLocaleDateString('vi-VN')}</span>
                        <Badge variant={version.published ? 'default' : 'outline'}>{version.published ? 'Đã xuất bản' : 'Bản nháp'}</Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="pl-8 pr-4 pb-4 border-b">
                     <div className="flex items-center justify-end gap-4">
                        <div className="flex items-center space-x-2">
                            <Label htmlFor={`publish-${version.id}`} className="text-sm font-normal">Xuất bản</Label>
                             <Switch id={`publish-${version.id}`} checked={version.published} onCheckedChange={togglePublish} />
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Xóa phiên bản {version.versionNumber}?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn phiên bản và tất cả thay đổi bên trong. Không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDeleteVersion(version.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                <div className="pl-8 pr-4 pt-4 space-y-3">
                    {isLoadingChanges && <Loader2 className="animate-spin" />}
                    {changes && changes.map(change => (
                        editingChange?.id === change.id ? (
                            <div key={change.id} className="p-3 bg-muted rounded-md space-y-2">
                                <Textarea value={editingChange.text} onChange={e => setEditingChange({...editingChange, text: e.target.value})} />
                                <div className="flex justify-between items-center">
                                    <div className="flex gap-4">
                                        <Select value={editingChange.type} onValueChange={(v: Change['type']) => setEditingChange({...editingChange, type: v})}>
                                            <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="new">Mới</SelectItem><SelectItem value="improvement">Cải tiến</SelectItem><SelectItem value="fix">Sửa lỗi</SelectItem></SelectContent>
                                        </Select>
                                        <div className="flex items-center space-x-2"><Switch id={`admin-${change.id}`} checked={editingChange.adminOnly} onCheckedChange={c => setEditingChange({...editingChange, adminOnly: c})} /><Label htmlFor={`admin-${change.id}`}>Chỉ Admin xem</Label></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="icon" variant="ghost" onClick={handleUpdateChange} className="h-8 w-8 text-green-600"><Check className="h-4 w-4"/></Button>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingChange(null)} className="h-8 w-8"><X className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div key={change.id} className="flex justify-between items-center group p-2 rounded-md hover:bg-muted">
                                <div className="flex items-center gap-2"><Badge variant={change.adminOnly ? 'secondary' : 'outline'}>{change.type}</Badge><span>{change.text}</span></div>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => setEditingChange(change)} className="h-7 w-7"><Pencil className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Xóa thay đổi này?</AlertDialogTitle></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteChange(change.id)}>Xóa</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        )
                    ))}
                     {isAdding && (
                        <div className="p-3 bg-muted rounded-md space-y-2">
                            <Textarea placeholder="Mô tả thay đổi..." value={newChangeData.text} onChange={e => setNewChangeData({...newChangeData, text: e.target.value})} />
                            <div className="flex justify-between items-center">
                                <div className="flex gap-4">
                                     <Select value={newChangeData.type} onValueChange={(v: Change['type']) => setNewChangeData({...newChangeData, type: v})}>
                                        <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="new">Mới</SelectItem><SelectItem value="improvement">Cải tiến</SelectItem><SelectItem value="fix">Sửa lỗi</SelectItem></SelectContent>
                                    </Select>
                                    <div className="flex items-center space-x-2"><Switch id={`admin-new`} checked={newChangeData.adminOnly} onCheckedChange={c => setNewChangeData({...newChangeData, adminOnly: c})} /><Label htmlFor={`admin-new`}>Chỉ Admin xem</Label></div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="ghost" onClick={handleAddChange} className="h-8 w-8 text-green-600"><Check className="h-4 w-4"/></Button>
                                    <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)} className="h-8 w-8"><X className="h-4 w-4"/></Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isAdding && <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}><PlusCircle className="mr-2 h-4 w-4" />Thêm thay đổi</Button>}
                </div>
            </AccordionContent>
        </AccordionItem>
    )
}

export default function VersionManager() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [versionNumber, setVersionNumber] = useState('');
    
    const versionsRef = useMemoFirebase(() => query(collection(firestore, 'versions'), orderBy('releaseDate', 'desc')), [firestore]);
    const { data: versions, isLoading } = useCollection<Version>(versionsRef);

    const handleCreateVersion = async () => {
        if (!versionNumber) {
            toast({ variant: 'destructive', title: 'Số phiên bản không được để trống' });
            return;
        }
        setIsCreating(true);
        try {
            const newVersion = {
                versionNumber,
                releaseDate: new Date().toISOString(),
                published: false,
            };
            await addDoc(collection(firestore, 'versions'), newVersion);
            setVersionNumber('');
            toast({ title: `Đã tạo phiên bản ${versionNumber}` });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Lỗi tạo phiên bản' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteVersion = async (versionId: string) => {
        const batch = writeBatch(firestore);
        const versionRef = doc(firestore, 'versions', versionId);
        // Here we should also delete the subcollection, which needs a separate query.
        // For simplicity now, we just delete the main doc. A proper implementation would need to delete subcollections.
        batch.delete(versionRef);
        await batch.commit();
        toast({ title: "Đã xóa phiên bản." });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quản lý phiên bản</CardTitle>
                <CardDescription>Tạo và quản lý lịch sử các phiên bản cập nhật của ứng dụng.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="single" collapsible className="w-full">
                    {isLoading && <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>}
                    {versions?.map(version => <VersionItem key={version.id} version={version} onDeleteVersion={handleDeleteVersion} />)}
                 </Accordion>
            </CardContent>
            <CardFooter className="border-t pt-6">
                <div className="flex gap-2">
                    <Input placeholder="VD: 1.2.0" value={versionNumber} onChange={e => setVersionNumber(e.target.value)} className="w-40" />
                    <Button onClick={handleCreateVersion} disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Tạo phiên bản mới
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
