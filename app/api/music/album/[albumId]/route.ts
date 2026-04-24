import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Album view deprecated in generic YouTube mode' }, { status: 400 })
}
