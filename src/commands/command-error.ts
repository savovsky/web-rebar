/**
 * CommandError — the single failure type of the §N command layer.
 * Commands validate their params and throw this on violation; the UI (status
 * bar), tests, and the future MCP adapter branch on `code`, never on message
 * text. Validation is non-blocking per §K.4 only for code-compliance warnings —
 * structurally invalid input (unknown ids, impossible geometry) IS an error.
 */
export type CommandErrorCode = 'INVALID_PARAMS' | 'NOT_FOUND';

export class CommandError extends Error {
  readonly code: CommandErrorCode;

  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
  }
}
