import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const GENERATED_DIR = join(process.cwd(), 'tests', 'e2e', 'generated')
const SPEC_FILE = join(GENERATED_DIR, 'builder-test.spec.ts')
const BUILDER_CONFIG = join(process.cwd(), 'playwright.builder.config.ts').replace(/\\/g, '/')
const CWD = process.cwd()

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    // Write the spec file if code was provided
    if (code?.trim()) {
      await mkdir(GENERATED_DIR, { recursive: true })
      await writeFile(SPEC_FILE, code, 'utf8')
    }

    // On Windows, use "start" to launch a fully detached new process.
    // /B = no new window (Playwright opens its own Electron window anyway).
    // Wrap the whole npx command in a second set of quotes required by cmd /c start.
    const cmd =
      process.platform === 'win32'
        ? `cmd /c start "" /B npx playwright test --ui --config="${BUILDER_CONFIG}"`
        : `npx playwright test --ui --config="${BUILDER_CONFIG}"`

    exec(cmd, { cwd: CWD, windowsHide: false })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
