
"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { User, Version, Change } from "@/types/firebase";
import { Loader2 } from "lucide-react";

interface VersionHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: User['role'];
}

type ChangeWithId = Change & { id: string };

const getBadgeVariant = (type: Change['type']) => {
  switch (type) {
    case 'new': return 'default';
    case 'improvement': return 'secondary';
    case 'fix': return 'destructive';
    default: return 'outline';
  }
};

const getBadgeText = (type: Change['type']) => {
  switch (type) {
    case 'new': return 'Mới';
    case 'improvement': return 'Cải tiến';
    case 'fix': return 'Sửa lỗi';
    default: return 'Khác';
  }
};

function VersionDetail({ version, userRole }: { version: Version, userRole: User['role'] }) {
    const firestore = useFirestore();
    const isAdmin = userRole === 'ADMIN';

    const changesRef = useMemoFirebase(() => 
        query(collection(firestore, 'versions', version.id, 'changes'), orderBy('order', 'asc')),
        [firestore, version.id]
    );
    const { data: changes, isLoading } = useCollection<ChangeWithId>(changesRef);

    const visibleChanges = useMemo(() => {
        if (!changes) return [];
        return changes.filter(change => isAdmin || !change.adminOnly);
    }, [changes, isAdmin]);

    if (isLoading) {
        return (
             <div className="pl-6 mt-2 space-y-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
             </div>
        )
    }

    if (visibleChanges.length === 0) return null;

    return (
        <div key={version.id}>
            <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-primary">{version.versionNumber}</h3>
            <p className="text-sm text-muted-foreground">{new Date(version.releaseDate).toLocaleDateString('vi-VN')}</p>
            </div>
            <ul className="mt-2 ml-2 space-y-2 border-l border-border pl-6">
            {visibleChanges.map((change) => (
                <li key={change.id} className="relative flex items-start gap-3">
                    <div className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <Badge variant={getBadgeVariant(change.type)} className="flex-shrink-0 mt-0.5">
                        {getBadgeText(change.type)}
                    </Badge>
                    <p className="text-sm">{change.text}</p>
                </li>
            ))}
            </ul>
        </div>
    )
}


export function VersionHistoryDialog({ isOpen, onOpenChange, userRole }: VersionHistoryDialogProps) {
    const firestore = useFirestore();
    const versionsRef = useMemoFirebase(() => query(collection(firestore, 'versions'), orderBy('releaseDate', 'desc')), [firestore]);
    const { data: versions, isLoading: isLoadingVersions } = useCollection<Version>(versionsRef);
    
    const latestVersion = useMemo(() => {
        return versions && versions.length > 0 ? versions[0].versionNumber : '...';
    }, [versions]);
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Lịch sử Cập nhật (Phiên bản {latestVersion})</DialogTitle>
                    <DialogDescription>
                        Các tính năng mới, cải tiến và sửa lỗi trong các phiên bản đã phát hành.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4 -mr-4">
                    <div className="space-y-8">
                    {isLoadingVersions ? (
                        <div className="flex justify-center items-center h-40">
                             <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : versions && versions.length > 0 ? (
                        versions.map((version) => (
                           <VersionDetail key={version.id} version={version} userRole={userRole} />
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground">Chưa có lịch sử cập nhật nào.</p>
                    )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
