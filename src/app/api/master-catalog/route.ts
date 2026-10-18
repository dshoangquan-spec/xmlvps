import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const items = await prisma.masterCatalogItem.findMany({
      orderBy: { productName: 'asc' },
    });
    return NextResponse.json(items);
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
