import { FolderManager } from './folderTools';
import type { ToolCall } from './ollama';

export const getToolDefinitions = (mode: 'readonly' | 'ask') => {
  const tools: any[] = [
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description:
          'Lists the contents of a directory within the working folder. Use empty string "" for root. DO NOT USE TO READ FILE CONTENTS.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to directory (e.g. "", "src", "Data")',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description:
          'Reads contents of a file. Use startLine and endLine to read in chunks if large, to save context window.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to file' },
            startLine: { type: 'number', description: 'Optional. Start line number (1-indexed)' },
            endLine: { type: 'number', description: 'Optional. End line number (inclusive)' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search',
        description:
          'Searches for exact text across files in working folder. Returns matching file paths and line numbers.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The exact string to search for' },
          },
          required: ['query'],
        },
      },
    },
  ];

  if (mode === 'ask') {
    tools.push({
      type: 'function',
      function: {
        name: 'create_file',
        description:
          'Creates a NEW file with given content. FAILS if the file already exists (use edit_file or write_file instead). For .json files, content MUST be valid JSON.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path for new file (e.g. "Data/new_tasks.json")',
            },
            content: { type: 'string', description: 'The entire content of the new file' },
          },
          required: ['path', 'content'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'write_file',
        description:
          'Writes or completely replaces the entire content of a file (limit 100 KB). Recommended for small files, config files, JSON data (like Data/tasks.json), or full rewrites when precise replacement with edit_file is difficult. For .json files, content MUST be valid JSON.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path to the file to create or overwrite',
            },
            content: {
              type: 'string',
              description: 'The entire content to write into the file',
            },
          },
          required: ['path', 'content'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'edit_file',
        description:
          'Edits an existing file by replacing old_str with new_str. old_str MUST match exactly one unique occurrence in the file. Use read_file first to see exact whitespace and indentation. If file is small, write_file is often easier and less error-prone. For .json files, the result MUST remain valid JSON.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file to edit' },
            old_str: {
              type: 'string',
              description: 'The exact string to be replaced (must match exactly once)',
            },
            new_str: { type: 'string', description: 'The replacement string' },
          },
          required: ['path', 'old_str', 'new_str'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'delete_file',
        description: 'Deletes a file from the working folder.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path to the file to delete' },
          },
          required: ['path'],
        },
      },
    });
  }

  return tools;
};

export const executeReadOnlyTool = async (
  call: ToolCall,
  manager: FolderManager
): Promise<string> => {
  const { name, arguments: args } = call.function;
  try {
    if (name === 'list_dir') {
      return await manager.listDir(args?.path ?? '');
    } else if (name === 'read_file') {
      return await manager.readFile(args?.path ?? '', args?.startLine, args?.endLine);
    } else if (name === 'search') {
      return await manager.search(args?.query ?? '');
    } else {
      return JSON.stringify({
        ok: false,
        action: name,
        error_code: 'unauthorized_tool',
        message: `Tool ${name} adalah operasi tulis dan memerlukan persetujuan pengguna.`,
      });
    }
  } catch (e: any) {
    return JSON.stringify({
      ok: false,
      action: name,
      error_code: 'read_failed',
      message: `Error: ${e.message || e}`,
    });
  }
};
