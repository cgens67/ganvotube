import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Artist view deprecated in generic YouTube mode' }, { status: 400 })
}
