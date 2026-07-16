'use client';

import { useMemo } from 'react';
import { collection, type Firestore } from 'firebase/firestore';

import { useCollection, useMemoFirebase } from '@/firebase';
import type { Mapping, MasterCatalogItem, Supplier, User as CustomUser } from '@/types/firebase';

export function useInvoiceCatalogData(firestore: Firestore, currentUser: CustomUser | null) {
  const mappingsRef = useMemoFirebase(
    () => currentUser ? collection(firestore, 'users', currentUser.id, 'mappings') : null,
    [firestore, currentUser],
  );
  const { data: mappingsData, isLoading: isLoadingMappings } = useCollection<Mapping>(mappingsRef);

  const suppliersRef = useMemoFirebase(
    () => currentUser ? collection(firestore, 'users', currentUser.id, 'suppliers') : null,
    [firestore, currentUser],
  );
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useCollection<Supplier>(suppliersRef);

  const masterCatalogRef = useMemoFirebase(() => collection(firestore, 'master_catalog'), [firestore]);
  const { data: masterCatalogData, isLoading: isLoadingMasterCatalog } = useCollection<MasterCatalogItem>(masterCatalogRef);

  const mapping = useMemo(() => {
    const map = new Map<string, Mapping>();
    mappingsData?.forEach(item => map.set(item.id, item));
    return map;
  }, [mappingsData]);

  const supplierMapping = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliersData?.forEach(item => map.set(item.id, item));
    return map;
  }, [suppliersData]);

  const masterCatalog = useMemo(() => {
    const map = new Map<string, MasterCatalogItem>();
    masterCatalogData?.forEach(item => map.set(item.id, item));
    return map;
  }, [masterCatalogData]);

  return {
    mapping,
    supplierMapping,
    masterCatalog,
    isLoadingMappings,
    isLoadingSuppliers,
    isLoadingMasterCatalog,
  };
}
