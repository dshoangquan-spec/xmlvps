import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const sortBy = searchParams.get('sortBy') || 'updateCount';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Xác thực trường sortBy hợp lệ để tránh SQL injection hoặc lỗi Prisma
    const validSortFields = [
      'updateCount',
      'originalCode',
      'newName',
      'newCode',
      'newUnit',
      'conversionRate',
      'masterCatalogId',
      'supplierTaxCode',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updateCount';

    const where = search
      ? {
          OR: [
            { originalCode: { contains: search, mode: 'insensitive' as const } },
            { newName: { contains: search, mode: 'insensitive' as const } },
            { newCode: { contains: search, mode: 'insensitive' as const } },
            { supplierTaxCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    if (all) {
      const items = await prisma.communityMapping.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
      });
      return NextResponse.json({ items, total: items.length });
    }

    const [items, total] = await Promise.all([
      prisma.communityMapping.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortField]: sortOrder },
      }),
      prisma.communityMapping.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Community mappings fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.communityMapping.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
    return NextResponse.json(item);
  } catch (error: any) {
    console.error('Community mapping save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    const item = await prisma.communityMapping.update({
      where: { id: data.id },
      data: {
        masterCatalogId: data.masterCatalogId ?? null,
      },
    });
    return NextResponse.json(item);
  } catch (error: any) {
    console.error('Community mapping update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    await prisma.communityMapping.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Community mapping delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
