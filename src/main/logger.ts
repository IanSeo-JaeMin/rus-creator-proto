import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'

// Get app installation path
function getAppPath(): string {
  if (is.dev) {
    // Development: use project root
    return join(__dirname, '../../')
  } else {
    // Production: use executable directory
    let appPath = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath()
    // If app.getAppPath() returns resources/app or app, go up one level
    if (appPath.includes('resources') || appPath.endsWith('app')) {
      appPath = join(appPath, '..')
    }
    return appPath
  }
}

const LOG_DIR = join(getAppPath(), 'logs')
const LOG_FILE = join(LOG_DIR, 'app.log')

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true })
}

// Clear log file on startup (optional - comment out to keep logs)
if (existsSync(LOG_FILE)) {
  writeFileSync(LOG_FILE, '', 'utf-8')
}

function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString()
  const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : ''
  return `[${timestamp}] [${level}] ${message}${argsStr}\n`
}

function writeToFile(level: string, message: string, ...args: any[]): void {
  try {
    appendFileSync(LOG_FILE, formatMessage(level, message, ...args), 'utf-8')
  } catch (error) {
    // If file writing fails, at least output to console
    console.error('Failed to write to log file:', error)
  }
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    const formatted = formatMessage('INFO', message, ...args).trim()
    console.log(formatted)
    writeToFile('INFO', message, ...args)
  },
  
  warn: (message: string, ...args: any[]) => {
    const formatted = formatMessage('WARN', message, ...args).trim()
    console.warn(formatted)
    writeToFile('WARN', message, ...args)
  },
  
  error: (message: string, ...args: any[]) => {
    const formatted = formatMessage('ERROR', message, ...args).trim()
    console.error(formatted)
    writeToFile('ERROR', message, ...args)
  },
  
  debug: (message: string, ...args: any[]) => {
    const formatted = formatMessage('DEBUG', message, ...args).trim()
    console.log(formatted)
    writeToFile('DEBUG', message, ...args)
  },
  
  getLogPath: () => LOG_FILE
}
