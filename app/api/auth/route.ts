import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth — Server-side password verification
// Password stays in .env.local and never reaches the browser
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const APP_PASSWORD = process.env.APP_PASSWORD;

    if (!APP_PASSWORD) {
      console.error('[API/auth] APP_PASSWORD is not set in environment variables.');
      return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 });
    }

    if (password === APP_PASSWORD) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, error: '不正なリクエスト' }, { status: 400 });
  }
}
