import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const items = await prisma.mapping.findMany({
      where: { userId },
    });
    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Mappings fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, mapping } = await req.json();
    if (!userId || !mapping) {
      return NextResponse.json({ error: 'userId and mapping required' }, { status: 400 });
    }

    const saved = await prisma.mapping.upsert({
      where: {
        userId_id: {
          userId,
          id: mapping.id,
        },
      },
      create: {
        ...mapping,
        userId,
      },
      update: mapping,
    });
    return NextResponse.json(saved);
  } catch (error: any) {
    console.error('Mapping save error:', error);
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

    await prisma.mapping.delete({
      where: {
        userId_id: { userId, id },
      },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Mapping delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
