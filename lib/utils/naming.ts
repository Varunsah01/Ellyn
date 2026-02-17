/**
 * Normalize arbitrary text into alphanumeric word tokens.
 * Handles kebab-case, snake_case, camelCase, PascalCase, and spaced strings.
 */
function tokenize(value: string): string[] {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim();

  if (!spaced) {
    return [];
  }

  return spaced
    .split(" ")
    .map((token) => token.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((token) => token.length > 0);
}

/**
 * Convert a value to `snake_case`.
 *
 * @param value - Input string.
 * @returns Converted string in snake_case.
 * @example
 * toSnakeCase("firstName") // "first_name"
 * @example
 * toSnakeCase("First Name") // "first_name"
 */
export function toSnakeCase(value: string): string {
  const tokens = tokenize(value);
  return tokens.map((token) => token.toLowerCase()).join("_");
}

/**
 * Convert a value to `camelCase`.
 *
 * @param value - Input string.
 * @returns Converted string in camelCase.
 * @example
 * toCamelCase("first_name") // "firstName"
 * @example
 * toCamelCase("First Name") // "firstName"
 */
export function toCamelCase(value: string): string {
  const tokens = tokenize(value).map((token) => token.toLowerCase());
  if (tokens.length === 0) {
    return "";
  }

  const [first, ...rest] = tokens;
  return `${first}${rest.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join("")}`;
}

/**
 * Convert a value to `PascalCase`.
 *
 * @param value - Input string.
 * @returns Converted string in PascalCase.
 * @example
 * toPascalCase("contact_form") // "ContactForm"
 * @example
 * toPascalCase("contactForm") // "ContactForm"
 */
export function toPascalCase(value: string): string {
  const tokens = tokenize(value).map((token) => token.toLowerCase());
  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join("");
}

