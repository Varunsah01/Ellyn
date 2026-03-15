import { writeFileSync } from "node:fs";

const outputPath = "extension/scripts/todos-contract.js";

const source = `/* eslint-disable no-undef */
/**
 * AUTO-GENERATED FILE. Source of truth: lib/todos.ts.
 * Run: node scripts/generate-extension-todos-contract.mjs
 */
(function attachTodoContract(global) {
  const TODO_CONTRACT = Object.freeze({
    maxTodoItems: 30,
    maxTextLength: 180,
    maxCompletedItems: 2,
    maxIdLength: 80,
  });

  function normalizeTodoText(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/\\s+/g, " ")
      .trim()
      .slice(0, TODO_CONTRACT.maxTextLength);
  }

  function normalizeTodoTimestamp(value) {
    if (typeof value !== "string" || !value.trim()) {
      return new Date().toISOString();
    }

    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return new Date().toISOString();
    }

    return parsed.toISOString();
  }

  function toMillis(value) {
    const parsed = new Date(value);
    const ms = parsed.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function normalizeTodoItem(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const id = typeof value.id === "string" ? value.id.trim().slice(0, TODO_CONTRACT.maxIdLength) : "";
    const text = normalizeTodoText(value.text);
    if (!id || !text) return null;

    return {
      id,
      text,
      completed: Boolean(value.completed),
      created_at: normalizeTodoTimestamp(value.created_at),
      updated_at: normalizeTodoTimestamp(value.updated_at),
    };
  }

  function sanitizeTodoItems(rawItems) {
    const sourceItems = Array.isArray(rawItems) ? rawItems : [];
    const deduped = new Map();

    sourceItems.forEach((raw) => {
      const normalized = normalizeTodoItem(raw);
      if (!normalized) return;
      deduped.set(normalized.id, normalized);
    });

    const sorted = Array.from(deduped.values()).sort(
      (a, b) => toMillis(b.updated_at) - toMillis(a.updated_at)
    );

    const active = sorted.filter((item) => !item.completed);
    const completed = sorted
      .filter((item) => item.completed)
      .slice(0, TODO_CONTRACT.maxCompletedItems);

    return [...active, ...completed].slice(0, TODO_CONTRACT.maxTodoItems);
  }

  function makeTodoItem(text) {
    const now = new Date().toISOString();
    return {
      id: \
        "todo_" +
        Date.now() +
        "_" +
        Math.random().toString(36).slice(2, 10),
      text: normalizeTodoText(text),
      completed: false,
      created_at: now,
      updated_at: now,
    };
  }

  function toggleTodoItem(items, id) {
    const now = new Date().toISOString();
    return sanitizeTodoItems(
      (Array.isArray(items) ? items : []).map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              updated_at: now,
            }
          : item
      )
    );
  }

  global.EllynTodoContract = Object.freeze({
    TODO_CONTRACT,
    normalizeTodoText,
    normalizeTodoTimestamp,
    sanitizeTodoItems,
    makeTodoItem,
    toggleTodoItem,
  });
})(typeof window !== "undefined" ? window : globalThis);
`;

writeFileSync(outputPath, source);
console.log(`Wrote ${outputPath}`);
