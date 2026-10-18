import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const sessions = await prisma.importSession.findMany({
      where: { userId },
      orderBy: { importDate: 'desc' },
      include: {
        invoices: {
          include: {
            items: true,
          },
        },
      },
    });
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Import sessions fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, fileNames, invoiceCount, itemCount, invoices } = await req.json();

    const result = await prisma.$transaction(async (tx: any) => {
      const session = await tx.importSession.create({
        data: {
          userId,
          fileNames: fileNames || [],
          invoiceCount: invoiceCount || 0,
          itemCount: itemCount || 0,
        },
      });

      if (invoices && Array.isArray(invoices)) {
        for (const inv of invoices) {
          const createdInvoice = await tx.invoice.create({
            data: {
              invoiceNumber: inv.id || inv.invoiceNumber,
              uniqueIdentifier: inv.uniqueIdentifier,
              importSessionId: session.id,
              provider: inv.provider || '',
              invoiceDate: inv.invoiceDate,
              sellerName: inv.sellerName,
              sellerTaxCode: inv.sellerTaxCode,
              sellerAddress: inv.sellerAddress || '',
              buyerName: inv.buyerName || '',
              fileName: inv.fileName || '',
              portalLink: inv.portalLink || '',
              accessCode: inv.accessCode || '',
            },
          });

          if (inv.items && Array.isArray(inv.items)) {
            for (const item of inv.items) {
              await tx.invoiceItem.create({
                data: {
                  userId,
                  invoiceId: createdInvoice.id,
                  invoiceDate: inv.invoiceDate,
                  invoiceDateISO: item.invoiceDateISO || new Date().toISOString().split('T')[0],
                  sellerName: inv.sellerName,
                  lineNumber: item.lineNumber || '',
                  itemCode: item.itemCode,
                  itemName: item.itemName,
                  manufacturer: item.manufacturer || '',
                  unit: item.unit,
                  quantity: String(item.quantity),
                  unitPrice: String(item.unitPrice),
                  totalAmount: String(item.totalAmount),
                  taxRate: String(item.taxRate),
                  lotNumber: item.lotNumber || '',
                  expirationDate: item.expirationDate || '',
                },
              });
            }
          }
        }
      }

      return session;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Import session save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    await prisma.importSession.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Import session delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
