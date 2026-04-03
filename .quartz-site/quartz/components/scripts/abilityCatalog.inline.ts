type RulebookCatalogEntry = {
  id: string
  name: string
  rank: string
  price: string
  previewDescription: string
  fullDescription: string
  tags: string[]
  filters: Record<string, string>
  sortValues: Record<string, number>
}

type RangeControl = {
  field: string
  unit: string
  minInput: HTMLInputElement
  maxInput: HTMLInputElement
}

const catalogSelector = ".rulebook-ability-catalog"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderValue(value: string) {
  return value ? escapeHtml(value) : "—"
}

function renderPrice(value: string) {
  return value ? `${escapeHtml(value)} кр` : "—"
}

function renderMetaChips(entry: RulebookCatalogEntry) {
  if (entry.tags.length === 0) {
    return ""
  }

  return `
    <div class="rulebook-ability-catalog__meta-chips">
      ${entry.tags
        .map(
          (value) => `
            <span class="rulebook-ability-catalog__meta-chip">${escapeHtml(value)}</span>
          `,
        )
        .join("")}
    </div>
  `
}

function renderChevronIcon(className: string) {
  return `
    <svg
      class="${className}"
      viewBox="0 0 16 16"
      focusable="false"
    >
      <path
        d="M4 6.25 8 10.25 12 6.25"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.8"
      />
    </svg>
  `
}

function renderToggleIndicator() {
  return `
    <span class="rulebook-ability-catalog__toggle-indicator" aria-hidden="true">
      ${renderChevronIcon("rulebook-ability-catalog__toggle-icon")}
    </span>
  `
}

function renderRows(entries: RulebookCatalogEntry[], expanded: Set<string>) {
  return entries
    .map(
      (entry) => `
        <tr
          class="rulebook-ability-catalog__summary-row${expanded.has(entry.id) ? " is-expanded" : ""}"
          data-entry-summary="${entry.id}"
          data-entry-expanded="${expanded.has(entry.id) ? "true" : "false"}"
          tabindex="0"
        >
          <td data-column="rank">${renderValue(entry.rank)}</td>
          <td data-column="name">
            <div class="rulebook-ability-catalog__name-block">
              <strong>${escapeHtml(entry.name)}</strong>
              ${renderMetaChips(entry)}
            </div>
          </td>
          <td data-column="price">${renderPrice(entry.price)}</td>
          <td data-column="description">
            <div class="rulebook-ability-catalog__description-cell">
              <p class="rulebook-ability-catalog__description-preview">${renderValue(entry.previewDescription)}</p>
              ${renderToggleIndicator()}
            </div>
          </td>
        </tr>
        <tr class="rulebook-ability-catalog__detail-row${expanded.has(entry.id) ? " is-expanded" : ""}" data-entry-detail="${entry.id}" ${
          expanded.has(entry.id) ? "" : "hidden"
        }>
          <td colspan="4">
            <div class="rulebook-ability-catalog__detail-body">
              <span class="rulebook-ability-catalog__detail-label">Описание</span>
              <p>${renderValue(entry.fullDescription)}</p>
            </div>
          </td>
        </tr>
      `,
    )
    .join("")
}

function parseFilterNumber(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : null
}

function collectCheckedValues(catalog: HTMLElement, field: string) {
  return new Set(
    [...catalog.querySelectorAll<HTMLInputElement>(`[data-filter-field="${field}"]`)]
      .filter((input) => input.checked)
      .map((input) => input.value),
  )
}

function summarizeValues(values: string[]) {
  if (values.length === 0) {
    return "Все"
  }

  if (values.length <= 2) {
    return values.join(", ")
  }

  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`
}

function summarizeRange(minValue: string, maxValue: string, unit: string) {
  const min = minValue.trim()
  const max = maxValue.trim()

  if (!min && !max) {
    return "Все"
  }

  if (min && max) {
    return `${min}–${max} ${unit}`.trim()
  }

  if (min) {
    return `от ${min} ${unit}`.trim()
  }

  return `до ${max} ${unit}`.trim()
}

function setDropdownOpen(dropdown: HTMLElement, nextOpen: boolean) {
  const trigger = dropdown.querySelector<HTMLElement>("[data-dropdown-trigger]")
  const menu = dropdown.querySelector<HTMLElement>("[data-dropdown-menu]")
  if (!trigger || !menu) {
    return
  }

  dropdown.classList.toggle("is-open", nextOpen)
  trigger.setAttribute("aria-expanded", nextOpen ? "true" : "false")
  menu.hidden = !nextOpen
}

function closeAllDropdowns(catalog: HTMLElement, keepOpen?: HTMLElement | null) {
  catalog.querySelectorAll<HTMLElement>("[data-filter-dropdown]").forEach((dropdown) => {
    setDropdownOpen(dropdown, dropdown === keepOpen)
  })
}

function getMultiFilterFields(catalog: HTMLElement) {
  return [
    ...new Set(
      [...catalog.querySelectorAll<HTMLInputElement>("[data-filter-field]")]
        .map((input) => input.dataset.filterField ?? "")
        .filter(Boolean),
    ),
  ]
}

function getRangeControls(catalog: HTMLElement): RangeControl[] {
  return [...catalog.querySelectorAll<HTMLInputElement>("[data-catalog-range-min]")]
    .map((minInput) => {
      const field = minInput.dataset.catalogRangeMin
      if (!field) {
        return null
      }

      const maxInput = catalog.querySelector<HTMLInputElement>(`[data-catalog-range-max="${field}"]`)
      const dropdown = catalog.querySelector<HTMLElement>(`[data-filter-dropdown="${field}"]`)
      if (!maxInput || !dropdown) {
        return null
      }

      return {
        field,
        unit: dropdown.dataset.rangeUnit ?? "",
        minInput,
        maxInput,
      } satisfies RangeControl
    })
    .filter((control): control is RangeControl => Boolean(control))
}

function initAbilityCatalog(catalog: HTMLElement) {
  const dataNode = catalog.querySelector<HTMLScriptElement>(".rulebook-ability-catalog__data")
  const body = catalog.querySelector<HTMLElement>("[data-catalog-body]")
  const countNode = catalog.querySelector<HTMLElement>("[data-catalog-count]")
  const searchInput = catalog.querySelector<HTMLInputElement>("[data-catalog-search]")
  const sortInput = catalog.querySelector<HTMLInputElement>("[data-catalog-sort]")
  const filtersToggle = catalog.querySelector<HTMLButtonElement>("[data-catalog-filters-toggle]")
  const filtersPanel = catalog.querySelector<HTMLElement>("[data-catalog-filters-panel]")

  if (!dataNode || !body || !countNode || !searchInput || !sortInput || !filtersToggle || !filtersPanel) {
    return
  }

  const catalogBody = body
  const catalogCountNode = countNode
  const catalogSearchInput = searchInput
  const catalogSortInput = sortInput
  const catalogFiltersToggle = filtersToggle
  const catalogFiltersPanel = filtersPanel

  let entries: RulebookCatalogEntry[] = []
  try {
    entries = JSON.parse(decodeURIComponent(dataNode.textContent || "[]")) as RulebookCatalogEntry[]
  } catch {
    entries = []
  }

  const expandedEntries = new Set<string>()
  const multiFilterFields = getMultiFilterFields(catalog)
  const rangeControls = getRangeControls(catalog)
  const defaultSortValue =
    catalog.querySelector<HTMLElement>("[data-sort-option]")?.dataset.sortValue ?? "title-asc"

  function syncFiltersPanelState() {
    const isOpen = !catalogFiltersPanel.hidden
    catalogFiltersToggle.classList.toggle("is-active", isOpen)
    catalogFiltersToggle.setAttribute("aria-expanded", isOpen ? "true" : "false")
  }

  function syncSortState() {
    const activeValue = catalogSortInput.value
    const activeOption = catalog.querySelector<HTMLElement>(`[data-sort-option][data-sort-value="${activeValue}"]`)
    const activeLabel = activeOption?.textContent?.replace(/\s+/g, " ").trim() || "По названию"

    const dropdown = catalog.querySelector<HTMLElement>('[data-filter-dropdown="sort"]')
    const labelNode = dropdown?.querySelector<HTMLElement>("[data-dropdown-label]")
    if (labelNode) {
      labelNode.textContent = activeLabel
    }

    catalog.querySelectorAll<HTMLElement>("[data-sort-option]").forEach((option) => {
      const isActive = option.dataset.sortValue === activeValue
      option.classList.toggle("is-active", isActive)
      option.setAttribute("aria-pressed", isActive ? "true" : "false")
    })
  }

  function syncDropdownSummaries() {
    multiFilterFields.forEach((field) => {
      const dropdown = catalog.querySelector<HTMLElement>(`[data-filter-dropdown="${field}"]`)
      const labelNode = dropdown?.querySelector<HTMLElement>("[data-dropdown-label]")
      if (!dropdown || !labelNode) {
        return
      }

      const values = [...dropdown.querySelectorAll<HTMLInputElement>(`[data-filter-field="${field}"]`)]
        .filter((input) => input.checked)
        .map((input) => input.value)

      labelNode.textContent = summarizeValues(values)
      dropdown.classList.toggle("has-selection", values.length > 0)
    })

    rangeControls.forEach((control) => {
      const dropdown = catalog.querySelector<HTMLElement>(`[data-filter-dropdown="${control.field}"]`)
      const labelNode = dropdown?.querySelector<HTMLElement>("[data-dropdown-label]")
      if (!dropdown || !labelNode) {
        return
      }

      labelNode.textContent = summarizeRange(control.minInput.value, control.maxInput.value, control.unit)
      dropdown.classList.toggle(
        "has-selection",
        Boolean(control.minInput.value.trim() || control.maxInput.value.trim()),
      )
    })

    syncSortState()
  }

  function getFilteredEntries() {
    const searchNeedle = catalogSearchInput.value.trim().toLowerCase()
    const activeFilters = Object.fromEntries(
      multiFilterFields.map((field) => [field, collectCheckedValues(catalog, field)]),
    ) as Record<string, Set<string>>

    return entries.filter((entry) => {
      if (searchNeedle) {
        const haystack = `${entry.name} ${entry.previewDescription} ${entry.fullDescription}`.toLowerCase()
        if (!haystack.includes(searchNeedle)) {
          return false
        }
      }

      for (const field of multiFilterFields) {
        const values = activeFilters[field]
        if (values.size === 0) {
          continue
        }

        if (!values.has(entry.filters[field] ?? "")) {
          return false
        }
      }

      for (const control of rangeControls) {
        const minValue = parseFilterNumber(control.minInput.value)
        const maxValue = parseFilterNumber(control.maxInput.value)
        const entryValue = entry.sortValues[control.field]

        if (minValue !== null && (!Number.isFinite(entryValue) || entryValue < minValue)) {
          return false
        }

        if (maxValue !== null && (!Number.isFinite(entryValue) || entryValue > maxValue)) {
          return false
        }
      }

      return true
    })
  }

  function sortEntries(nextEntries: RulebookCatalogEntry[]) {
    const sorted = [...nextEntries]
    const activeOption = catalog.querySelector<HTMLElement>(`[data-sort-option][data-sort-value="${catalogSortInput.value}"]`)
    const sortKey = activeOption?.dataset.sortKey ?? "name"
    const sortDirection = activeOption?.dataset.sortDirection === "desc" ? -1 : 1

    sorted.sort((left, right) => {
      if (sortKey === "name") {
        return left.name.localeCompare(right.name, "ru") * sortDirection
      }

      const leftValue = left.sortValues[sortKey] ?? Number.MAX_SAFE_INTEGER
      const rightValue = right.sortValues[sortKey] ?? Number.MAX_SAFE_INTEGER
      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * sortDirection
      }

      return left.name.localeCompare(right.name, "ru")
    })

    return sorted
  }

  function render() {
    const nextEntries = sortEntries(getFilteredEntries())
    catalogBody.innerHTML = renderRows(nextEntries, expandedEntries)
    catalogCountNode.textContent = `Показано: ${nextEntries.length}`
    syncDropdownSummaries()
  }

  function resetFilters() {
    catalogSearchInput.value = ""
    catalogSortInput.value = defaultSortValue
    expandedEntries.clear()

    catalog.querySelectorAll<HTMLInputElement>("[data-filter-field]").forEach((input) => {
      input.checked = false
    })

    rangeControls.forEach((control) => {
      control.minInput.value = ""
      control.maxInput.value = ""
    })

    closeAllDropdowns(catalog)
  }

  function toggleEntry(entryId: string) {
    if (expandedEntries.has(entryId)) {
      expandedEntries.delete(entryId)
    } else {
      expandedEntries.add(entryId)
    }

    render()
  }

  function toggleFiltersPanel(nextState?: boolean) {
    const willOpen = nextState ?? catalogFiltersPanel.hidden
    catalogFiltersPanel.hidden = !willOpen
    if (!willOpen) {
      closeAllDropdowns(catalog)
    }
    syncFiltersPanelState()
  }

  function onClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (!target) return

    const resetButton = target.closest<HTMLElement>("[data-catalog-reset]")
    if (resetButton) {
      resetFilters()
      render()
      return
    }

    const filtersButton = target.closest<HTMLElement>("[data-catalog-filters-toggle]")
    if (filtersButton) {
      toggleFiltersPanel()
      return
    }

    const dropdownTrigger = target.closest<HTMLElement>("[data-dropdown-trigger]")
    if (dropdownTrigger) {
      const dropdown = dropdownTrigger.closest<HTMLElement>("[data-filter-dropdown]")
      if (!dropdown) return

      const willOpen = dropdown.querySelector<HTMLElement>("[data-dropdown-menu]")?.hidden ?? true
      closeAllDropdowns(catalog, willOpen ? dropdown : null)
      return
    }

    const sortOption = target.closest<HTMLElement>("[data-sort-option]")
    if (sortOption?.dataset.sortValue) {
      catalogSortInput.value = sortOption.dataset.sortValue
      closeAllDropdowns(catalog)
      render()
      return
    }

    const summaryRow = target.closest<HTMLElement>("[data-entry-summary]")
    if (summaryRow) {
      const entryId = summaryRow.dataset.entrySummary
      if (!entryId) return

      toggleEntry(entryId)
    }
  }

  function onInput(event: Event) {
    const target = event.target
    if (
      target === catalogSearchInput ||
      (target instanceof HTMLInputElement &&
        (target.hasAttribute("data-filter-field") ||
          target.hasAttribute("data-catalog-range-min") ||
          target.hasAttribute("data-catalog-range-max")))
    ) {
      render()
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (!catalogFiltersPanel.hidden) {
        closeAllDropdowns(catalog)
      }
      return
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    const target = event.target as HTMLElement | null
    const summaryRow = target?.closest<HTMLElement>("[data-entry-summary]")
    if (!summaryRow) {
      return
    }

    const entryId = summaryRow.dataset.entrySummary
    if (!entryId) {
      return
    }

    event.preventDefault()
    toggleEntry(entryId)
  }

  function onDocumentClick(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof Node)) {
      return
    }

    if (!catalog.contains(target)) {
      closeAllDropdowns(catalog)
      return
    }

    if (!(target instanceof HTMLElement)) {
      return
    }

    const isInsideDropdown = Boolean(target.closest("[data-filter-dropdown]"))
    if (!isInsideDropdown) {
      closeAllDropdowns(catalog)
    }
  }

  catalog.addEventListener("click", onClick)
  catalog.addEventListener("input", onInput)
  catalog.addEventListener("keydown", onKeyDown)
  document.addEventListener("click", onDocumentClick)
  window.addCleanup(() => {
    catalog.removeEventListener("click", onClick)
    catalog.removeEventListener("input", onInput)
    catalog.removeEventListener("keydown", onKeyDown)
    document.removeEventListener("click", onDocumentClick)
  })

  syncFiltersPanelState()
  syncSortState()
  render()
}

document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLElement>(catalogSelector).forEach((catalog) => {
    initAbilityCatalog(catalog)
  })
})
