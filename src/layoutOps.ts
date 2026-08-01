import { t } from "./libs/l10n"
import type { ColumnPanel, RowPanel, ViewPanel } from "./orca.d.ts"
import { PANEL_LAYOUTS_KEY, REFRESH_SETTINGS_BROADCAST } from "./constants"

export interface SavedLayout {
  activePanel: string
  panels: RowPanel
}

export interface PanelLayoutsData {
  default: string
  layouts: Record<string, SavedLayout>
}

type PanelNode = RowPanel | ColumnPanel | ViewPanel

// ---------- 数据读取 ----------

export function getLayoutsData(): PanelLayoutsData {
  const raw = orca.state.settings[PANEL_LAYOUTS_KEY] as
    | PanelLayoutsData
    | undefined
  if (
    raw != null &&
    typeof raw === "object" &&
    raw.layouts != null &&
    typeof raw.layouts === "object"
  ) {
    return raw
  }
  return { default: "", layouts: {} }
}

export function getLayoutNames(): string[] {
  return Object.keys(getLayoutsData().layouts)
}

// ---------- 克隆（与官方实现一致） ----------

function isViewPanel(panel: PanelNode): panel is ViewPanel {
  return (panel as RowPanel | ColumnPanel).children == null
}

function cloneValue<T>(value: T): T {
  if (value == null) return value
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (Array.isArray(value)) return value.map(cloneValue) as T
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = cloneValue((value as Record<string, unknown>)[key])
    }
    return out as T
  }
  return value
}

// 保存布局时使用：保留结构，丢弃编辑器运行时状态（官方同样将 viewState 置空）。
function cloneViewPanel(panel: ViewPanel): ViewPanel {
  return { ...panel, viewArgs: cloneValue(panel.viewArgs), viewState: {} }
}

function cloneNode(panel: PanelNode): PanelNode {
  if (isViewPanel(panel)) return cloneViewPanel(panel)
  const container = panel as RowPanel | ColumnPanel
  return {
    ...container,
    children: container.children.map((child) => cloneNode(child)),
  } as RowPanel | ColumnPanel
}

export function clonePanels(panel: RowPanel): RowPanel {
  return cloneNode(panel) as RowPanel
}

// 应用布局时使用：为所有面板生成全新 id，避免与现有面板冲突。
function randomPanelId(): string {
  return Math.random().toString(36).slice(2, 12)
}

function cloneNodeWithFreshIds(
  panel: PanelNode,
  idMap: Map<string, string>,
): PanelNode {
  const freshId = randomPanelId()
  idMap.set(panel.id, freshId)
  if (isViewPanel(panel)) {
    return {
      ...panel,
      id: freshId,
      viewArgs: cloneValue(panel.viewArgs),
      viewState: cloneValue(panel.viewState),
    }
  }
  const container = panel as RowPanel | ColumnPanel
  return {
    ...container,
    id: freshId,
    children: container.children.map((child) =>
      cloneNodeWithFreshIds(child, idMap),
    ),
  } as RowPanel | ColumnPanel
}

function findFirstViewPanelId(panel: PanelNode): string | null {
  if (isViewPanel(panel)) return panel.id
  for (const child of (panel as RowPanel | ColumnPanel).children) {
    const found = findFirstViewPanelId(child)
    if (found != null) return found
  }
  return null
}

// ---------- 写入（与官方保存布局逻辑一致） ----------

async function writeLayouts(data: PanelLayoutsData): Promise<void> {
  orca.state.settings[PANEL_LAYOUTS_KEY] = data
  await orca.invokeBackend("set-config", PANEL_LAYOUTS_KEY, JSON.stringify(data))
  orca.broadcasts.broadcast(REFRESH_SETTINGS_BROADCAST, PANEL_LAYOUTS_KEY)
}

// 按官方实现注册 core.layout.<name> 命令（供命令面板与快捷键使用）。
function registerApplyCommand(name: string): void {
  const commandId = `core.layout.${name}`
  if (orca.state.commands[commandId] != null) return
  orca.commands.registerCommand(
    commandId,
    () => {
      const data = orca.state.settings[PANEL_LAYOUTS_KEY] as
        | PanelLayoutsData
        | undefined
      if (data == null || data.default === name) return
      const saved = data.layouts[name]
      if (saved == null) return
      applyLayout(saved)
    },
    t('Apply the layout "${name}"', { name }),
  )
}

export async function saveLayout(name: string): Promise<void> {
  const data = getLayoutsData()
  const next: PanelLayoutsData = {
    default: data.default,
    layouts: {
      ...data.layouts,
      [name]: {
        activePanel: orca.state.activePanel,
        panels: clonePanels(orca.state.panels),
      },
    },
  }
  registerApplyCommand(name)
  await writeLayouts(next)
}

export async function updateLayout(name: string): Promise<void> {
  await saveLayout(name)
}

export async function deleteLayout(name: string): Promise<void> {
  const data = getLayoutsData()
  const layouts = { ...data.layouts }
  delete layouts[name]
  const next: PanelLayoutsData = {
    default: data.default === name ? "" : data.default,
    layouts,
  }
  const commandId = `core.layout.${name}`
  if (orca.state.shortcuts[commandId] != null) {
    void orca.shortcuts.reset(commandId)
  }
  if (orca.state.commands[commandId] != null) {
    orca.commands.unregisterCommand(commandId)
  }
  await writeLayouts(next)
}

export async function makeDefault(name: string): Promise<void> {
  const data = getLayoutsData()
  await writeLayouts({ default: name, layouts: { ...data.layouts } })
}

// ---------- 应用 ----------

// 与官方 applyLayout 一致：克隆保存的面板并生成全新 id，清空历史后整体替换。
export function applyLayout(saved: SavedLayout): boolean {
  const idMap = new Map<string, string>()
  const panels = cloneNodeWithFreshIds(saved.panels, idMap) as RowPanel
  const activePanelId =
    idMap.get(saved.activePanel) ?? findFirstViewPanelId(panels)
  if (activePanelId == null) return false

  orca.state.panelBackHistory.length = 0
  orca.state.panelForwardHistory.length = 0
  orca.state.panels.id = panels.id
  orca.state.panels.direction = panels.direction
  orca.state.panels.children = panels.children
  orca.state.panels.height = panels.height
  orca.state.activePanel = activePanelId
  return true
}

export function applyLayoutByName(name: string): boolean {
  const saved = getLayoutsData().layouts[name]
  if (saved == null) return false
  return applyLayout(saved)
}

// 应用内置默认布局：调用官方 core.layout._default 命令（应用启动时必然注册）。
export async function applyDefaultLayout(): Promise<boolean> {
  const commandId = "core.layout._default"
  if (orca.state.commands[commandId] == null) return false
  await orca.commands.invokeCommand(commandId)
  return true
}
