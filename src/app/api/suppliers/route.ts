import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const items = await prisma.supplier.findMany({
      where: { userId },
    });
    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Suppliers fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, supplier } = await req.json();
    if (!userId || !supplier) {
      return NextResponse.json({ error: 'userId and supplier required' }, { status: 400 });
    }

    const saved = await prisma.supplier.upsert({
      where: {
        userId_id: {
          userId,
          id: supplier.id,
        },
      },
      create: {
        ...supplier,
        userId,
      },
      update: supplier,
    });
    return NextResponse.json(saved);
  } catch (error: any) {
    console.error('Supplier save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const id = searchParams.get('id');
    if (!userId || !id) {
      return NextResponse.json({ error: 'userId and id required' }, { status: 400 });
    }

    await prisma.supplier.delete({
      where: {
        userId_id: { userId, id },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Supplier delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
