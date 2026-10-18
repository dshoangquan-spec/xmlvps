import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const all = searchParams.get('all') === 'true';

    // Nếu gọi thông thường không có phân trang và không có search, trả về mảng danh mục (để tương thích combobox dropdown)
    if (!hasPagination && !all && !searchParams.has('search')) {
      const items = await prisma.masterCatalogItem.findMany({
        orderBy: { productName: 'asc' },
      });
      return NextResponse.json(items);
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const sortBy = searchParams.get('sortBy') || 'id';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    const validSortFields = [
      'id',
      'productName',
      'activeIngredient',
      'concentration',
      'registrationNumber',
      'packaging',
      'unit',
      'smallestUnit',
      'conversionRate',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';

    const where = search
      ? {
          OR: [
            { id: { contains: search, mode: 'insensitive' as const } },
            { productName: { contains: search, mode: 'insensitive' as const } },
            { activeIngredient: { contains: search, mode: 'insensitive' as const } },
            { concentration: { contains: search, mode: 'insensitive' as const } },
            { registrationNumber: { contains: search, mode: 'insensitive' as const } },
            { packaging: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    if (all) {
      const items = await prisma.masterCatalogItem.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
      });
      return NextResponse.json({ items, total: items.length });
    }

    const [items, total] = await Promise.all([
      prisma.masterCatalogItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortField]: sortOrder },
      }),
      prisma.masterCatalogItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Master catalog fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (Array.isArray(data)) {
      for (const item of data) {
        await prisma.masterCatalogItem.upsert({
          where: { id: item.id },
          create: item,
          update: item,
        });
      }
      return NextResponse.json({ success: true, count: data.length });
    } else {
      const item = await prisma.masterCatalogItem.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
      return NextResponse.json(item);
    }
  } catch (error: any) {
    console.error('Master catalog save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    if (all) {
      await prisma.masterCatalogItem.deleteMany({});
      return NextResponse.json({ success: true, message: 'Deleted all master catalog items' });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    await prisma.masterCatalogItem.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Master catalog delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
