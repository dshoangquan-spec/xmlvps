import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const items = await prisma.communityMapping.findMany({
      orderBy: { updateCount: 'desc' },
    });
    return NextResponse.json(items);
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
