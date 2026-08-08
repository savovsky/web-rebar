import { expect } from 'vitest';
import { CommandError, type CommandErrorCode } from '@/commands';

/** Assert that fn throws a CommandError with the given code; returns it for message checks. */
export const expectCommandError = (fn: () => unknown, code: CommandErrorCode): CommandError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CommandError);
    expect((error as CommandError).code).toBe(code);
    return error as CommandError;
  }
  throw new Error(`Expected CommandError (${code}) but nothing was thrown`);
};
