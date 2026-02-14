/**
 * Built-in tools available to OpenClaw agents running in Docker containers.
 * All tools are sandboxed within the container.
 */

const fs = require('fs')
const path = require('path')

const WORKSPACE = '/workspace'

// Ensure workspace exists
if (!fs.existsSync(WORKSPACE)) {
  fs.mkdirSync(WORKSPACE, { recursive: true })
}

const tools = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the agent workspace',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the agent workspace',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory in the agent workspace',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to workspace (default: root)' },
      },
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL (GET request)',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the agent workspace (sandboxed)',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
      },
      required: ['command'],
    },
  },
  {
    name: 'think',
    description: 'Use this tool to think step-by-step about a problem before taking action. Output is not shown to the user.',
    parameters: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your thinking/reasoning' },
      },
      required: ['thought'],
    },
  },
]

async function executeToolCall(name, args) {
  switch (name) {
    case 'read_file': {
      const filePath = path.join(WORKSPACE, args.path)
      if (!filePath.startsWith(WORKSPACE)) return 'Error: Access denied — path outside workspace'
      if (!fs.existsSync(filePath)) return `Error: File not found: ${args.path}`
      return fs.readFileSync(filePath, 'utf8')
    }

    case 'write_file': {
      const filePath = path.join(WORKSPACE, args.path)
      if (!filePath.startsWith(WORKSPACE)) return 'Error: Access denied — path outside workspace'
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, args.content, 'utf8')
      return `File written: ${args.path} (${args.content.length} chars)`
    }

    case 'list_files': {
      const dirPath = path.join(WORKSPACE, args.path || '')
      if (!dirPath.startsWith(WORKSPACE)) return 'Error: Access denied — path outside workspace'
      if (!fs.existsSync(dirPath)) return `Error: Directory not found: ${args.path || '/'}`
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries.map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n') || '(empty)'
    }

    case 'web_fetch': {
      try {
        const res = await fetch(args.url, { signal: AbortSignal.timeout(10000) })
        const text = await res.text()
        // Limit response size
        return text.slice(0, 10000)
      } catch (err) {
        return `Error fetching ${args.url}: ${err.message}`
      }
    }

    case 'run_command': {
      const { execSync } = require('child_process')
      try {
        const output = execSync(args.command, {
          cwd: WORKSPACE,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8',
        })
        return output.slice(0, 10000)
      } catch (err) {
        return `Command error: ${err.message}`
      }
    }

    case 'think': {
      console.log(`[Agent Think] ${args.thought}`)
      return 'Thought recorded.'
    }

    default:
      return `Unknown tool: ${name}`
  }
}

module.exports = { tools, executeToolCall }
