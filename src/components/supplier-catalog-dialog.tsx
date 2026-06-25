
"use client";

import { useState, useMemo, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Supplier } from "@/types/firebase";
import { Search, Trash2, Pencil, Check, X, PlusCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportSupplierCatalogToExcel } from "@/lib/excel-exporter";


interface SupplierCatalogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  supplierMapping: Map<string, Supplier>;
  onAddSupplier: (newSupplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onUpdateSupplier: (originalId: string, newValues: Supplier) => void;
}

const emptySupplier: Supplier = {
  id: "",
  supplierCode: "",
  supplierName: "",
};

export function SupplierCatalogDialog({
  isOpen,
  onOpenChange,
  supplierMapping,
  onAddSupplier,
  onDeleteSupplier,
  onUpdateSupplier,
}: SupplierCatalogDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Supplier | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState<Supplier>(emptySupplier);
  const { toast } = useToast();

  const supplierArray = useMemo(() => {
    const baseArray = Array.from(supplierMapping.values());
    if (!searchTerm) {
      return baseArray;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return baseArray.filter(
      (info) =>
        (info.supplierCode && info.supplierCode.toLowerCase().includes(lowercasedFilter)) ||
        info.supplierName.toLowerCase().includes(lowercasedFilter) ||
        info.id.toLowerCase().includes(lowercasedFilter)
    );
  }, [supplierMapping, searchTerm]);

  useEffect(() => {
    if (editingTaxId && !supplierArray.some(s => s.id === editingTaxId)) {
        setEditingTaxId(null);
        setEditFormData(null);
    }
  }, [supplierArray, editingTaxId]);
  
  const handleEdit = (info: Supplier) => {
    setIsAdding(false);
    setEditingTaxId(info.id);
    setEditFormData({ ...info });
  };

  const handleCancelEdit = () => {
    setEditingTaxId(null);
    setEditFormData(null);
  };
  
  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewSupplierData(emptySupplier);
  };


  const handleSaveEdit = () => {
    if (editingTaxId && editFormData) {
      if (!editFormData.id || editFormData.id.trim() === '' || !editFormData.supplierName || editFormData.supplierName.trim() === '') {
        toast({
          variant: "destructive",
          title: "Thiếu thông tin",
          description: "Mã số thuế và Tên nhà cung cấp là bắt buộc."
        });
        return;
      }
      onUpdateSupplier(editingTaxId, editFormData);
      handleCancelEdit();
    }
  };

  const handleSaveNew = () => {
    if (!newSupplierData.id || newSupplierData.id.trim() === '' || !newSupplierData.supplierName || newSupplierData.supplierName.trim() === '') {
       toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Mã số thuế và Tên nhà cung cấp là bắt buộc."
      });
      return;
    }
    if (supplierMapping.has(newSupplierData.id)) {
        toast({
            variant: "destructive",
            title: "Mã số thuế đã tồn tại",
            description: "Nhà cung cấp với mã số thuế này đã có trong danh sách."
        });
        return;
    }
    onAddSupplier(newSupplierData);
    handleCancelAdd();
  };

  const handleInputChange = (field: keyof Supplier, value: string, isNew: boolean) => {
    if (isNew) {
        setNewSupplierData(prev => ({ ...prev, [field]: value }));
    } else if (editFormData) {
      setEditFormData({ ...editFormData, [field]: value });
    }
  };
  
  const handleExport = () => {
    if (supplierArray.length === 0) {
        toast({
            variant: "destructive",
            title: "Không có dữ liệu",
            description: "Không có nhà cung cấp nào để xuất."
        });
        return;
    }
    exportSupplierCatalogToExcel(supplierArray);
  };


  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCancelEdit();
          handleCancelAdd();
          setSearchTerm("");
        }
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle>
                Danh sách Nhà cung cấp ({supplierArray.length} mục)
              </DialogTitle>
              <DialogDescription>
                Đây là toàn bộ các nhà cung cấp đã được tải lên. Bạn có thể tìm kiếm, sửa, xóa và thêm mới.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm Mã NCC, Tên NCC, Mã số thuế..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="mt-4">
          <ScrollArea className="h-[60vh] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted z-10">
                <TableRow>
                  <TableHead className="font-semibold w-[40%]">Tên nhà cung cấp</TableHead>
                  <TableHead className="font-semibold w-[20%]">Mã nhà cung cấp</TableHead>
                  <TableHead className="font-semibold w-[25%]">Mã số thuế</TableHead>
                  <TableHead className="font-semibold w-[15%] text-center">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAdding && (
                    <TableRow>
                        <TableCell><Input value={newSupplierData.supplierName} onChange={(e) => handleInputChange('supplierName', e.target.value, true)} placeholder="Tên nhà cung cấp (*)" className="h-8"/></TableCell>
                        <TableCell><Input value={newSupplierData.supplierCode} onChange={(e) => handleInputChange('supplierCode', e.target.value, true)} placeholder="Mã nội bộ" className="h-8"/></TableCell>
                        <TableCell><Input value={newSupplierData.id} onChange={(e) => handleInputChange('id', e.target.value, true)} placeholder="Mã số thuế (*)" className="h-8"/></TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                                <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={handleSaveNew}><Check className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-700" onClick={handleCancelAdd}><X className="h-4 w-4" /></Button>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
                {supplierArray.length === 0 && !isAdding ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground h-24"
                    >
                      {searchTerm
                        ? "Không tìm thấy kết quả."
                        : "Chưa có dữ liệu nhà cung cấp."}
                    </TableCell>
                  </TableRow>
                ) : (
                  supplierArray.map((info) => {
                    const isEditing = editingTaxId === info.id;
                    const currentData = isEditing ? editFormData : info;

                    return (
                    <TableRow key={info.id} className={isEditing ? "bg-muted/50" : ""}>
                       <TableCell>
                        {isEditing ? (
                            <Input value={currentData?.supplierName} onChange={(e) => handleInputChange('supplierName', e.target.value, false)} className="h-8"/>
                          ) : (
                            currentData?.supplierName
                          )}
                      </TableCell>
                      <TableCell>
                         {isEditing ? (
                            <Input value={currentData?.supplierCode} onChange={(e) => handleInputChange('supplierCode', e.target.value, false)} className="h-8"/>
                          ) : (
                            currentData?.supplierCode
                          )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                            <Input value={currentData?.id} onChange={(e) => handleInputChange('id', e.target.value, false)} className="h-8"/>
                          ) : (
                            currentData?.id
                          )}
                      </TableCell>
                      <TableCell className="text-center">
                          {isEditing ? (
                              <div className="flex justify-center gap-2">
                              <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={handleSaveEdit}>
                                  <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-700" onClick={handleCancelEdit}>
                                  <X className="h-4 w-4" />
                              </Button>
                              </div>
                          ) : (
                              <div className="flex justify-center gap-2">
                              <Button variant="ghost" size="icon" className="text-primary hover:text-primary/90" onClick={() => handleEdit(info)}>
                                  <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90">
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                      Hành động này sẽ xóa vĩnh viễn nhà cung cấp
                                      <span className="font-bold text-foreground"> {info.supplierName}</span>. 
                                      Bạn không thể hoàn tác.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                                      <AlertDialogAction
                                      onClick={() => onDeleteSupplier(info.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                      >
                                      Xóa
                                      </AlertDialogAction>
                                  </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                              </div>
                          )}
                          </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
         <DialogFooter className="mt-4 justify-between">
            <div>
                 {!isAdding && (
                  <Button onClick={() => { setIsAdding(true); setEditingTaxId(null); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm NCC mới
                  </Button>
                )}
            </div>
            <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Xuất ra Excel
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    