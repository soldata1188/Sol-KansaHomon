import { NextRequest, NextResponse } from 'next/server';

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbwoaB1_RZ0nheTgUNptjVz-Cv6ysusph7C_LKl3HYC2__3EygtnIrdzxAXiatXCnI0jwg/exec';

// GET: Load data from Google Sheets via server-side fetch (no CORS)
export async function GET() {
  try {
    // Server-side fetch follows redirects automatically - no CORS restrictions
    const response = await fetch(GAS_URL, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'User-Agent': 'NextJS-Server/1.0',
      },
    });

    const text = await response.text();
    console.log('[API/sync GET] Status:', response.status, '| Body preview:', text.substring(0, 200));

    // Try to parse as JSON
    let data: { enterprises: unknown[]; cache: unknown };
    try {
      const parsed = JSON.parse(text);
      data = {
        enterprises: parsed.enterprises || [],
        cache: parsed.cache || {},
      };
    } catch {
      console.error('[API/sync GET] Failed to parse GAS response as JSON. Raw:', text.substring(0, 500));
      data = { enterprises: [], cache: {} };
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[API/sync GET] Fetch error:', error);
    return NextResponse.json(
      { enterprises: [], cache: {}, error: String(error) },
      { status: 200 } // Return 200 so app doesn't crash, just gets empty data
    );
  }
}

// POST: Save data to Google Sheets via server-side fetch (no CORS)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = JSON.stringify(body);

    console.log('[API/sync POST] Sending', body.enterprises?.length ?? 0, 'enterprises to GAS');

    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'NextJS-Server/1.0',
      },
      body: payload,
      redirect: 'follow',
    });

    const text = await response.text();
    console.log('[API/sync POST] GAS response status:', response.status, '| Body:', text.substring(0, 200));

    return NextResponse.json({
      success: true,
      gasStatus: response.status,
      message: text,
    });
  } catch (error) {
    console.error('[API/sync POST] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
