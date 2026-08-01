import { t } from "./libs/l10n"
import {
  applyDefaultLayout,
  applyLayoutByName,
  deleteLayout,
  getLayoutsData,
  makeDefault,
  saveLayout,
  updateLayout,
} from "./layoutOps"

// 侧边栏标签的值：与官方收藏/标签/页面平级
export const LAYOUT_TAB_KEY = "layoutManager"

const TAB_ITEM_CLASS = "orca-lm-tab-item"
const CONTENT_CLASS = "orca-lm-sidebar-content"

let injected = false
let observer: MutationObserver | null = null
let unsubscribe: (() => void) | null = null

let tabItem: HTMLElement | null = null
let contentContainer: HTMLElement | null = null

// 表单/交互状态（纯 DOM 实现，保存于模块级）
let newName = ""
let confirmingDelete: string | null = null
let confirmingOverwrite: string | null = null
let busy = false
let lastSignature = ""

// 稳定的子元素引用（避免外部刷新时重建输入框导致失焦）
let inputEl: HTMLInputElement | null = null
let saveBtnEl: HTMLButtonElement | null = null
let overwriteRowEl: HTMLElement | null = null
let listEl: HTMLElement | null = null

type NotifyType = "info" | "success" | "warn" | "error"

function notify(type: NotifyType, message: string): void {
  orca.notify(type, message, { title: t("Layout Manager") })
}

// ---------- 入口 / 清理 ----------

export function injectSidebarLayoutTab(): void {
  injected = true
  ensureTabItem()
  ensureContent()
  refreshAll()

  // 侧边栏可能在插件加载后才挂载，或重渲染后丢失注入节点：
  // 监听 document.body，自动恢复标签项与内容容器。
  if (observer == null) {
    observer = new MutationObserver(() => {
      ensureTabItem()
      ensureContent()
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  if (unsubscribe == null) {
    // 订阅全局状态：切换标签、官方菜单/本插件改动布局都会反映到侧边栏。
    unsubscribe = window.Valtio.subscribe(orca.state, () => refreshAll())
  }
}

export function removeSidebarLayoutTab(): void {
  injected = false
  if (observer != null) {
    observer.disconnect()
    observer = null
  }
  if (unsubscribe != null) {
    unsubscribe()
    unsubscribe = null
  }
  tabItem?.remove()
  tabItem = null
  contentContainer?.remove()
  contentContainer = null
  document.querySelector("nav#sidebar")?.classList.remove("orca-lm-active")
  inputEl = null
  saveBtnEl = null
  overwriteRowEl = null
  listEl = null
}

// ---------- 注入 ----------

// 在标签行（.orca-sidebar-tab-options，即原生 Segmented）末尾追加第 4 个
// 原生样式的标签项「布局」，位于 收藏/标签/页面 右侧。
function ensureTabItem(): void {
  if (!injected) return
  const row = document.querySelector<HTMLElement>(".orca-sidebar-tab-options")
  if (row == null) return
  if (tabItem != null && tabItem.isConnected && tabItem.parentElement === row) {
    updateSelected()
    return
  }
  if (tabItem != null) {
    tabItem.remove()
    tabItem = null
  }

  const item = document.createElement("div")
  item.className = `orca-segmented-item ${TAB_ITEM_CLASS}`
  item.title = t("Layouts")
  item.textContent = t("Layouts")
  item.addEventListener("mousedown", (e) => e.stopPropagation())
  item.addEventListener("click", (e) => {
    e.stopPropagation()
    orca.state.sidebarTab = LAYOUT_TAB_KEY
  })
  row.appendChild(item)
  tabItem = item
  updateSelected()
}

// 在侧边栏中插入布局管理列表容器（作为 .orca-sidebar-tabs 的兄弟节点）。
// 官方 MemoizedViews 对未知标签要么保持旧视图可见、要么整体渲染为 null，
// 因此不把内容注入其内部；激活「布局」标签时通过 nav 上的类名隐藏原生内容区。
function ensureContent(): void {
  if (!injected) return
  const nav = document.querySelector<HTMLElement>("nav#sidebar")
  if (nav == null) return
  if (
    contentContainer != null &&
    contentContainer.isConnected &&
    contentContainer.parentElement === nav
  ) {
    updateVisibility()
    return
  }
  if (contentContainer != null) {
    contentContainer.remove()
    contentContainer = null
  }

  const container = document.createElement("div")
  container.className = CONTENT_CLASS
  const section = nav.querySelector<HTMLElement>(".orca-sidebar-tabs")
  const resizer = nav.querySelector<HTMLElement>(".orca-sidebar-resizer")
  if (section != null) {
    section.after(container)
  } else if (resizer != null) {
    nav.insertBefore(container, resizer)
  } else {
    nav.appendChild(container)
  }
  contentContainer = container
  buildSkeleton()
  updateVisibility()
  refreshControls()
}

// ---------- 状态刷新 ----------

function layoutsSignature(): string {
  const data = getLayoutsData()
  return `${data.default}|${Object.keys(data.layouts).sort().join(",")}`
}

function refreshAll(): void {
  updateSelected()
  updateVisibility()
  const signature = layoutsSignature()
  if (signature !== lastSignature) {
    lastSignature = signature
    refreshControls()
  }
}

function updateSelected(): void {
  if (tabItem == null) return
  tabItem.classList.toggle("orca-selected", orca.state.sidebarTab === LAYOUT_TAB_KEY)
}

function updateVisibility(): void {
  const active = orca.state.sidebarTab === LAYOUT_TAB_KEY
  if (contentContainer == null) return
  contentContainer.style.display = active ? "flex" : "none"
  // 隐藏官方标签内容区，让我们的列表占据与原生「标签/页面」相同的位置
  document
    .querySelector("nav#sidebar")
    ?.classList.toggle("orca-lm-active", active)
}

// ---------- 布局列表（纯 DOM 渲染） ----------

function buildSkeleton(): void {
  if (contentContainer == null) return

  const saveRow = document.createElement("div")
  saveRow.className = "orca-lm-save-row"

  const input = document.createElement("input")
  input.type = "text"
  input.className = "orca-lm-input"
  input.placeholder = t("New layout name")
  input.addEventListener("input", () => {
    newName = input.value
    confirmingOverwrite = null
    refreshOverwriteRow()
  })
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter") void doSave(false)
  })
  inputEl = input

  const saveBtn = makeButton("ti ti-device-floppy", t("Save layout"), () =>
    void doSave(false),
  )
  saveBtn.classList.add("orca-lm-btn-primary")
  saveBtn.appendChild(document.createTextNode(t("Save layout")))
  saveBtnEl = saveBtn

  saveRow.append(input, saveBtn)

  const overwriteRow = document.createElement("div")
  overwriteRow.className = "orca-lm-overwrite-row"
  overwriteRowEl = overwriteRow

  const actionsRow = document.createElement("div")
  actionsRow.className = "orca-lm-actions-row"
  actionsRow.appendChild(
    makeTextButton(t("Apply the default layout"), () => void doApplyDefault()),
  )

  const divider = document.createElement("div")
  divider.className = "orca-lm-divider"

  const subtitle = document.createElement("div")
  subtitle.className = "orca-lm-subtitle"
  subtitle.textContent = t("Saved layouts")

  const list = document.createElement("div")
  list.className = "orca-lm-list"
  listEl = list

  contentContainer.append(
    saveRow,
    overwriteRow,
    actionsRow,
    divider,
    subtitle,
    list,
  )
  refreshOverwriteRow()
}

function refreshControls(): void {
  if (inputEl != null) {
    if (document.activeElement !== inputEl) inputEl.value = newName
    inputEl.disabled = busy
  }
  if (saveBtnEl != null) saveBtnEl.disabled = busy
  refreshOverwriteRow()
  refreshList()
}

function refreshOverwriteRow(): void {
  if (overwriteRowEl == null) return
  if (confirmingOverwrite == null) {
    overwriteRowEl.style.display = "none"
    overwriteRowEl.replaceChildren()
    return
  }
  overwriteRowEl.style.display = "flex"
  const hint = document.createElement("span")
  hint.textContent = t(
    "A layout with this name already exists, do you want to replace it?",
  )
  const ok = makeTextButton(t("Confirm"), () => void doSave(true), "danger")
  const cancel = makeTextButton(t("Cancel"), () => {
    confirmingOverwrite = null
    refreshOverwriteRow()
  })
  overwriteRowEl.replaceChildren(hint, ok, cancel)
}

function refreshList(): void {
  if (listEl == null) return
  const data = getLayoutsData()
  const names = Object.keys(data.layouts).sort((a, b) => a.localeCompare(b))
  if (names.length === 0) {
    const empty = document.createElement("div")
    empty.className = "orca-lm-empty"
    empty.textContent = t("No layouts yet. Save the current layout to get started.")
    listEl.replaceChildren(empty)
    return
  }

  const fragment = document.createDocumentFragment()
  for (const name of names) {
    fragment.appendChild(buildLayoutRow(name, data.default === name))
  }
  listEl.replaceChildren(fragment)
}

function buildLayoutRow(name: string, isDefault: boolean): HTMLElement {
  const row = document.createElement("div")
  row.className = "orca-lm-layout-row"

  const nameBox = document.createElement("div")
  nameBox.className = "orca-lm-layout-name"
  const nameText = document.createElement("span")
  nameText.className = "orca-lm-layout-name-text"
  nameText.textContent = name
  nameBox.appendChild(nameText)
  if (isDefault) {
    const badge = document.createElement("span")
    badge.className = "orca-lm-badge"
    badge.textContent = t("(default)")
    nameBox.appendChild(badge)
  }

  const actions = document.createElement("div")
  actions.className = "orca-lm-row-actions"

  if (confirmingDelete === name) {
    const hint = document.createElement("span")
    hint.className = "orca-lm-delete-hint"
    hint.textContent = t("Delete this layout? This cannot be undone!")
    const ok = makeButton("ti ti-check", t("Confirm"), () => void doDelete(name), {
      danger: true,
    })
    const cancel = makeButton("ti ti-x", t("Cancel"), () => {
      confirmingDelete = null
      refreshList()
    })
    actions.append(hint, ok, cancel)
  } else {
    actions.append(
      makeButton("ti ti-check", t("Apply"), () => void doApply(name)),
      makeButton("ti ti-device-floppy", t("Update layout"), () =>
        void doUpdate(name),
      ),
      makeButton("ti ti-star", t("Make default"), () => void doMakeDefault(name), {
        disabled: isDefault,
      }),
      makeButton("ti ti-trash", t("Delete layout"), () => void doDelete(name), {
        danger: true,
      }),
    )
  }

  // 点击名称直接应用该布局（与「标签/页面」点击切换的行为一致）
  nameBox.addEventListener("click", (e) => {
    e.stopPropagation()
    void doApply(name)
  })

  row.append(nameBox, actions)
  return row
}

function makeButton(
  icon: string,
  title: string,
  onClick: () => void,
  opts: { danger?: boolean; disabled?: boolean } = {},
): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "orca-lm-btn"
  if (opts.danger === true) btn.classList.add("orca-lm-btn-danger")
  btn.title = title
  btn.disabled = opts.disabled === true
  const i = document.createElement("i")
  i.className = icon
  btn.appendChild(i)
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  btn.addEventListener("mousedown", (e) => e.stopPropagation())
  return btn
}

function makeTextButton(
  label: string,
  onClick: () => void,
  variant: "danger" | "normal" = "normal",
): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "orca-lm-btn orca-lm-btn-text"
  if (variant === "danger") btn.classList.add("orca-lm-btn-danger")
  btn.textContent = label
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  btn.addEventListener("mousedown", (e) => e.stopPropagation())
  return btn
}

// ---------- 操作 ----------

async function doSave(override: boolean): Promise<void> {
  const name = newName.trim()
  if (name.length === 0) {
    notify("error", t("Name cannot be empty."))
    return
  }
  if (name.startsWith("_")) {
    notify("error", t("Names that start with _ are reserved."))
    return
  }
  if (!override && getLayoutsData().layouts[name] != null) {
    confirmingOverwrite = name
    refreshOverwriteRow()
    return
  }
  busy = true
  refreshControls()
  try {
    await saveLayout(name)
    newName = ""
    confirmingOverwrite = null
    notify("success", t("Layout saved"))
  } catch (err) {
    console.error("[orca-layout-manager] saveLayout failed", err)
    notify("error", t("Failed to save the layout"))
  } finally {
    busy = false
    refreshControls()
  }
}

async function doApply(name: string): Promise<void> {
  if (!applyLayoutByName(name)) {
    notify("error", t("Layout not found"))
    return
  }
  notify("success", t("Layout applied"))
}

async function doUpdate(name: string): Promise<void> {
  try {
    await updateLayout(name)
    notify("success", t("Layout saved"))
  } catch (err) {
    console.error("[orca-layout-manager] updateLayout failed", err)
    notify("error", t("Failed to save the layout"))
  }
}

async function doMakeDefault(name: string): Promise<void> {
  try {
    await makeDefault(name)
    notify("success", t("Set as default"))
  } catch (err) {
    console.error("[orca-layout-manager] makeDefault failed", err)
    notify("error", t("Failed to set the default layout"))
  }
}

async function doDelete(name: string): Promise<void> {
  if (confirmingDelete !== name) {
    confirmingDelete = name
    refreshList()
    return
  }
  try {
    await deleteLayout(name)
    confirmingDelete = null
    notify("success", t("Layout deleted"))
  } catch (err) {
    console.error("[orca-layout-manager] deleteLayout failed", err)
    notify("error", t("Failed to delete the layout"))
  }
}

async function doApplyDefault(): Promise<void> {
  try {
    const ok = await applyDefaultLayout()
    if (!ok) {
      notify("error", t("Failed to apply the default layout"))
      return
    }
    notify("success", t("Layout applied"))
  } catch (err) {
    console.error("[orca-layout-manager] applyDefaultLayout failed", err)
    notify("error", t("Failed to apply the default layout"))
  }
}
