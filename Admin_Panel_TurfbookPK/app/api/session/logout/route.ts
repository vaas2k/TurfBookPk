import { NextResponse } from 'next/server';
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set('turfbook_admin_access', '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 }); return response; }
