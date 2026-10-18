import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword } = await req.json();
    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'Thiếu thông tin cập nhật mật khẩu.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Lỗi server khi đổi mật khẩu.' }, { status: 500 });
  }
}
