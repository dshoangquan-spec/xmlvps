import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: 'Tên đăng nhập không tồn tại.' }, { status: 404 });
    }

    if (user.password !== password) {
      return NextResponse.json({ error: 'Mật khẩu không đúng.' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đăng nhập.' }, { status: 500 });
  }
}
