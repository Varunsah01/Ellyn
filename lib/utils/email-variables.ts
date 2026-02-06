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

export function getVariablesInText(text: string): string[] {
  const regex = /{{(\w+)}}/g;
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return [...new Set(matches)];
}
