import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';

// GET: Load data from Google Sheets
export async function GET() {
  try {
    const response = await fetch(GAS_URL, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ enterprises: [], cache: {} });
    }

    const data = await response.json();
    return NextResponse.json({
      enterprises: data.enterprises || [],
      cache: data.cache || {},
    });
  } catch (error) {
    console.error('GAS GET error:', error);
    return NextResponse.json({ enterprises: [], cache: {} });
  }
}

// POST: Save data to Google Sheets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });

    const text = await response.text();
    return NextResponse.json({ success: true, message: text });
  } catch (error) {
    console.error('GAS POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
