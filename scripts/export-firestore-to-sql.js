// Script trích xuất toàn bộ dữ liệu từ Firebase Firestore sang file PostgreSQL SQL (scripts/firestore-data.sql)
// Chạy bằng lệnh: node scripts/export-firestore-to-sql.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error("Không tìm thấy firebase-applet-config.json");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    if (val.toDate && typeof val.toDate === 'function') {
      return `'${val.toDate().toISOString()}'`;
    }
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function run() {
  console.log(">>> Đang kết nối tới Firestore và trích xuất dữ liệu...");
  const sqlStatements = [
    "-- ========================================================",
    "-- Dữ liệu đã trích xuất tự động từ Firestore sang PostgreSQL",
    `-- Thời gian trích xuất: ${new Date().toISOString()}`,
    "-- ========================================================\n",
  ];

  try {
    // 1. Users
    console.log("- Đang đọc bảng 'users'...");
    const usersSnap = await getDocs(collection(db, 'users'));
    const userIds = [];
    usersSnap.forEach((doc) => {
      const u = doc.data();
      userIds.push(doc.id);
      sqlStatements.push(
        `INSERT INTO users (id, username, password, full_name, role, created_at) ` +
        `VALUES (${escapeSql(doc.id)}, ${escapeSql(u.username)}, ${escapeSql(u.password || '123456')}, ${escapeSql(u.fullName || u.username)}, ${escapeSql(u.role || 'USER')}, ${escapeSql(u.createdAt || new Date())}) ` +
        `ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;`
      );
    });

    // 2. Master Catalog
    console.log("- Đang đọc bảng 'master_catalog'...");
    const masterSnap = await getDocs(collection(db, 'master_catalog'));
    masterSnap.forEach((doc) => {
      const m = doc.data();
      sqlStatements.push(
        `INSERT INTO master_catalog (id, product_name, active_ingredient, concentration, registration_number, packaging, unit, smallest_unit, conversion_rate) ` +
        `VALUES (${escapeSql(doc.id)}, ${escapeSql(m.productName)}, ${escapeSql(m.activeIngredient || '')}, ${escapeSql(m.concentration || '')}, ${escapeSql(m.registrationNumber || '')}, ${escapeSql(m.packaging || '')}, ${escapeSql(m.unit || '')}, ${escapeSql(m.smallestUnit || null)}, ${escapeSql(m.conversionRate || 1)}) ` +
        `ON CONFLICT (id) DO NOTHING;`
      );
    });

    // 3. Community Mappings
    console.log("- Đang đọc bảng 'community_mappings'...");
    const commSnap = await getDocs(collection(db, 'community_mappings'));
    commSnap.forEach((doc) => {
      const c = doc.data();
      sqlStatements.push(
        `INSERT INTO community_mappings (id, original_code, supplier_tax_code, new_code, new_name, new_unit, conversion_rate, update_count, master_catalog_id) ` +
        `VALUES (${escapeSql(doc.id)}, ${escapeSql(c.originalCode)}, ${escapeSql(c.supplierTaxCode || null)}, ${escapeSql(c.newCode)}, ${escapeSql(c.newName)}, ${escapeSql(c.newUnit)}, ${escapeSql(c.conversionRate || 1)}, ${escapeSql(c.updateCount || 1)}, ${escapeSql(c.masterCatalogId || null)}) ` +
        `ON CONFLICT (id) DO UPDATE SET update_count = EXCLUDED.update_count, master_catalog_id = EXCLUDED.master_catalog_id;`
      );
    });

    // 4. Per-user subcollections
    for (const userId of userIds) {
      console.log(`- Đang đọc dữ liệu của user: ${userId}...`);
      
      // Suppliers
      const supSnap = await getDocs(collection(db, 'users', userId, 'suppliers'));
      supSnap.forEach((doc) => {
        const s = doc.data();
        sqlStatements.push(
          `INSERT INTO suppliers (id, user_id, supplier_code, supplier_name) ` +
          `VALUES (${escapeSql(doc.id)}, ${escapeSql(userId)}, ${escapeSql(s.supplierCode || doc.id)}, ${escapeSql(s.supplierName || '')}) ` +
          `ON CONFLICT (user_id, id) DO NOTHING;`
        );
      });

      // Mappings
      const mapSnap = await getDocs(collection(db, 'users', userId, 'mappings'));
      mapSnap.forEach((doc) => {
        const m = doc.data();
        sqlStatements.push(
          `INSERT INTO mappings (id, user_id, original_code, supplier_tax_code, new_code, original_name, new_name, original_unit, new_unit, conversion_rate, master_catalog_id) ` +
          `VALUES (${escapeSql(doc.id)}, ${escapeSql(userId)}, ${escapeSql(m.originalCode)}, ${escapeSql(m.supplierTaxCode || null)}, ${escapeSql(m.newCode)}, ${escapeSql(m.originalName || m.newName)}, ${escapeSql(m.newName)}, ${escapeSql(m.originalUnit || null)}, ${escapeSql(m.newUnit)}, ${escapeSql(m.conversionRate || 1)}, ${escapeSql(m.masterCatalogId || null)}) ` +
          `ON CONFLICT (user_id, id) DO NOTHING;`
        );
      });

      // Pharmacy accounts & fee records
      const pharmSnap = await getDocs(collection(db, 'users', userId, 'pharmacy_accounts'));
      for (const pDoc of pharmSnap.docs) {
        const p = pDoc.data();
        sqlStatements.push(
          `INSERT INTO pharmacy_accounts (id, user_id, pharmacy_name, representative, usage_start_date, software_fee, software_fee_date, pm_name, pm_user, pm_pass, invoice_provider_name, invoice_user, invoice_pass, invoice_link, tax_user, tax_pass, electronic_tax_user, electronic_tax_pass, electronic_tax_link) ` +
          `VALUES (${escapeSql(pDoc.id)}, ${escapeSql(userId)}, ${escapeSql(p.pharmacyName || '')}, ${escapeSql(p.representative || null)}, ${escapeSql(p.usageStartDate || null)}, ${escapeSql(p.softwareFee || 0)}, ${escapeSql(p.softwareFeeDate || null)}, ${escapeSql(p.pmName || null)}, ${escapeSql(p.pmUser || null)}, ${escapeSql(p.pmPass || null)}, ${escapeSql(p.invoiceProviderName || null)}, ${escapeSql(p.invoiceUser || null)}, ${escapeSql(p.invoicePass || null)}, ${escapeSql(p.invoiceLink || null)}, ${escapeSql(p.taxUser || null)}, ${escapeSql(p.taxPass || null)}, ${escapeSql(p.electronicTaxUser || null)}, ${escapeSql(p.electronicTaxPass || null)}, ${escapeSql(p.electronicTaxLink || null)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );

        const feeSnap = await getDocs(collection(db, 'users', userId, 'pharmacy_accounts', pDoc.id, 'fee_records'));
        feeSnap.forEach((fDoc) => {
          const f = fDoc.data();
          sqlStatements.push(
            `INSERT INTO fee_records (id, pharmacy_account_id, month, tax_report_fee, invoice_import_fee, invoice_export_fee, total_fee, is_paid) ` +
            `VALUES (${escapeSql(fDoc.id)}, ${escapeSql(pDoc.id)}, ${escapeSql(f.month || fDoc.id)}, ${escapeSql(f.taxReportFee || 0)}, ${escapeSql(f.invoiceImportFee || 0)}, ${escapeSql(f.invoiceExportFee || 0)}, ${escapeSql(f.totalFee || 0)}, ${escapeSql(!!f.isPaid)}) ` +
            `ON CONFLICT (id) DO NOTHING;`
          );
        });
      }

      // Import sessions & Invoices
      const sessSnap = await getDocs(collection(db, 'users', userId, 'import_sessions'));
      sessSnap.forEach((sDoc) => {
        const s = sDoc.data();
        sqlStatements.push(
          `INSERT INTO import_sessions (id, user_id, import_date, file_names, invoice_count, item_count) ` +
          `VALUES (${escapeSql(sDoc.id)}, ${escapeSql(userId)}, ${escapeSql(s.importDate || new Date())}, ${escapeSql(s.fileNames || [])}, ${escapeSql(s.invoiceCount || 0)}, ${escapeSql(s.itemCount || 0)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
      });

      const invSnap = await getDocs(collection(db, 'users', userId, 'invoices'));
      invSnap.forEach((iDoc) => {
        const inv = iDoc.data();
        sqlStatements.push(
          `INSERT INTO invoices (id, invoice_number, unique_identifier, import_session_id, provider, invoice_date, seller_name, seller_tax_code, seller_address, buyer_name, file_name, portal_link, access_code) ` +
          `VALUES (${escapeSql(iDoc.id)}, ${escapeSql(inv.id || iDoc.id)}, ${escapeSql(inv.uniqueIdentifier || null)}, ${escapeSql(inv.importSessionId)}, ${escapeSql(inv.provider || '')}, ${escapeSql(inv.invoiceDate || '')}, ${escapeSql(inv.sellerName || '')}, ${escapeSql(inv.sellerTaxCode || '')}, ${escapeSql(inv.sellerAddress || '')}, ${escapeSql(inv.buyerName || '')}, ${escapeSql(inv.fileName || '')}, ${escapeSql(inv.portalLink || null)}, ${escapeSql(inv.accessCode || null)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
      });
    }

    // 5. Versions & changes
    console.log("- Đang đọc bảng 'versions'...");
    const verSnap = await getDocs(collection(db, 'versions'));
    for (const vDoc of verSnap.docs) {
      const v = vDoc.data();
      sqlStatements.push(
        `INSERT INTO versions (id, version_number, release_date, published) ` +
        `VALUES (${escapeSql(vDoc.id)}, ${escapeSql(v.versionNumber || '1.0.0')}, ${escapeSql(v.releaseDate || new Date())}, ${escapeSql(!!v.published)}) ` +
        `ON CONFLICT (id) DO NOTHING;`
      );

      const chSnap = await getDocs(collection(db, 'versions', vDoc.id, 'changes'));
      chSnap.forEach((cDoc) => {
        const c = cDoc.data();
        sqlStatements.push(
          `INSERT INTO changes (id, version_id, type, text, admin_only, "order") ` +
          `VALUES (${escapeSql(cDoc.id)}, ${escapeSql(vDoc.id)}, ${escapeSql(c.type || 'improvement')}, ${escapeSql(c.text || '')}, ${escapeSql(!!c.adminOnly)}, ${escapeSql(c.order || 0)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
      });
    }

    const outPath = path.join(__dirname, 'firestore-data.sql');
    fs.writeFileSync(outPath, sqlStatements.join('\n\n'), 'utf8');
    console.log(`\n=== ĐÃ TRÍCH XUẤT THÀNH CÔNG VÀO: ${outPath} ===`);
    console.log(`Tổng cộng ${sqlStatements.length - 1} lệnh SQL.`);
    process.exit(0);
  } catch (err) {
    console.error("Lỗi trích xuất:", err);
    process.exit(1);
  }
}

run();
