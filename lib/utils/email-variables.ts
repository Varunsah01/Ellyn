export interface EmailVariable {
  key: string;
  label: string;
  example: string;
}

export const emailVariables: EmailVariable[] = [
  { key: "firstName", label: "First Name", example: "John" },
  { key: "lastName", label: "Last Name", example: "Smith" },
  { key: "fullName", label: "Full Name", example: "John Smith" },
  { key: "company", label: "Company", example: "Google" },
  { key: "role", label: "Role", example: "Software Engineer" },
  { key: "linkedinUrl", label: "LinkedIn URL", example: "linkedin.com/in/john" },
  { key: "userFirstName", label: "Your First Name", example: "Sarah" },
  { key: "userLastName", label: "Your Last Name", example: "Johnson" },
  { key: "userCompany", label: "Your Company", example: "Ellyn" },
];

/**
 * Replace variables.
 * @param {string} template - Template input.
 * @param {Record<string, string>} data - Data input.
 * @returns {string} Computed string.
 * @example
 * replaceVariables('template', 'data')
 */
export function replaceVariables(
  template: string,
  data: Record<string, string>
): string {
  let result = template;

  emailVariables.forEach((variable) => {
    const regex = new RegExp(`{{${variable.key}}}`, "g");
    result = result.replace(regex, data[variable.key] || `{{${variable.key}}}`);
  });

  return result;
}

/**
 * Insert variable.
 * @param {string} text - Text input.
 * @param {number} cursorPosition - Cursor position input.
 * @param {string} variableKey - Variable key input.
 * @returns {{ text: string; newCursorPosition: number }} Computed { text: string; newCursorPosition: number }.
 * @example
 * insertVariable('text', 0, 'variableKey')
 */
export function insertVariable(
  text: string,
  cursorPosition: number,
  variableKey: string
): { text: string; newCursorPosition: number } {
  const variable = `{{${variableKey}}}`;
  const before = text.slice(0, cursorPosition);
  const after = text.slice(cursorPosition);

  return {
    text: before + variable + after,
    newCursorPosition: cursorPosition + variable.length,
  };
}

/**
 * Get variables in text.
 * @param {string} text - Text input.
 * @returns {string[]} Computed string[].
 * @example
 * getVariablesInText('text')
 */
export function getVariablesInText(text: string): string[] {
  const regex = /{{(\w+)}}/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const variable = match[1];
    if (variable) {
      matches.push(variable);
    }
  }

  return [...new Set(matches)];
}
