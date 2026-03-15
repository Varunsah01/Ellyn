(function initSidepanelTodo(globalScope) {
  function createTodoModule(deps) {
    const {
      sanitizeTodoItems,
      normalizeTodoText,
      makeTodoItem,
      toggleTodoItem,
      escapeHtml,
      state,
      elements,
      storageGet,
      storageSet,
      todoCacheKey,
      isAuthenticated,
      fetchTodosFromApi,
      saveTodosToApi,
      showToast,
      logger,
    } = deps;

    function renderTodoList() {
      if (!elements.todoList || !elements.todoEmptyState) return;
      const items = sanitizeTodoItems(state.todoItems);
      state.todoItems = items;

      if (items.length === 0) {
        elements.todoList.innerHTML = "";
        elements.todoEmptyState.classList.remove("hidden");
      } else {
        elements.todoEmptyState.classList.add("hidden");
        elements.todoList.innerHTML = items
          .map((item) => {
            const disabled = state.todoSaveInFlight ? "disabled" : "";
            return `<li><button type="button" class="ellyn-todo-item ${item.completed ? "is-completed" : ""}" data-todo-toggle="true" data-todo-id="${escapeHtml(item.id)}" ${disabled}><span class="ellyn-todo-check" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6.25 4.8 9 10 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span><span class="ellyn-todo-text">${escapeHtml(item.text)}</span></button></li>`;
          })
          .join("");
      }
      if (elements.todoSaveBtn) elements.todoSaveBtn.disabled = state.todoSaveInFlight;
      if (elements.todoAddMoreBtn) elements.todoAddMoreBtn.disabled = state.todoSaveInFlight;
    }

    async function persistTodosToCache(items) {
      const normalized = sanitizeTodoItems(items);
      state.todoItems = normalized;
      await storageSet({ [todoCacheKey]: normalized });
    }

    async function loadTodosFromCache() {
      try {
        const stored = await storageGet([todoCacheKey]);
        state.todoItems = sanitizeTodoItems(stored?.[todoCacheKey]);
      } catch (error) {
        logger.warn("[Sidepanel] Failed to load todo cache:", error);
        state.todoItems = [];
      }
    }

    async function persistTodoItems(items) {
      const normalized = sanitizeTodoItems(items);
      state.todoItems = normalized;
      renderTodoList();
      try { await persistTodosToCache(normalized); } catch (error) { logger.warn("[Sidepanel] Failed to persist todo cache:", error); }
      if (!isAuthenticated()) return;
      state.todoSaveInFlight = true;
      renderTodoList();
      try {
        const synced = await saveTodosToApi(normalized);
        state.todoItems = synced;
        await persistTodosToCache(synced);
      } catch (error) {
        logger.warn("[Sidepanel] Failed to save todos to server:", error);
        showToast("To-do saved locally. We'll sync it soon.", "info");
      } finally {
        state.todoSaveInFlight = false;
        renderTodoList();
      }
    }

    async function handleTodoSave() {
      if (state.todoSaveInFlight) return;
      const text = normalizeTodoText(elements.todoInput?.value);
      if (!text) return;
      const nextItem = makeTodoItem(text);
      if (elements.todoInput) elements.todoInput.value = "";
      await persistTodoItems([nextItem, ...state.todoItems]);
    }

    async function toggleTodoItemById(todoId) {
      if (state.todoSaveInFlight) return;
      const normalizedId = String(todoId || "").trim();
      if (!normalizedId) return;
      await persistTodoItems(toggleTodoItem(state.todoItems, normalizedId));
    }

    return {
      renderTodoList,
      loadTodosFromCache,
      persistTodoItems,
      handleTodoSave,
      toggleTodoItemById,
      syncTodosFromServer: async function syncTodosFromServer() {
        if (!isAuthenticated()) return;
        try {
          const remoteItems = await fetchTodosFromApi();
          const mergedItems = sanitizeTodoItems([...(state.todoItems || []), ...remoteItems]);
          state.todoItems = mergedItems;
          await persistTodosToCache(mergedItems);
          renderTodoList();
          const synced = await saveTodosToApi(mergedItems);
          state.todoItems = synced;
          await persistTodosToCache(synced);
          renderTodoList();
        } catch (error) {
          logger.warn("[Sidepanel] Failed to sync todos from server:", error);
        }
      },
    };
  }

  globalScope.EllynSidepanelTodo = Object.freeze({ createTodoModule });
})(globalThis);
