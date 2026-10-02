import { NextResponse } from 'next/server';
const apiUrl = process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export async function POST(request: Request) { const upstream = await fetch(`${apiUrl}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text(), cache: 'no-store' }); return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status, headers: { 'Cache-Control': 'no-store' } }); }
