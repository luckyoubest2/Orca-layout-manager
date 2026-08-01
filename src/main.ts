import { setupL10N, t } from "./libs/l10n"
import zhCN from "./translations/zhCN"
import {
  JOURNAL_TO_TODAY_SETTING,
  SHOW_GO_DEFAULT_SETTING,
  SHOW_CREATE_LAYOUT_SETTING,
  SHOW_LAYOUT_ACTIONS_SETTING,
  AUTO_HIDE_SCROLLBARS_SETTING,
  AUTO_HIDE_PANEL_ACTIONS_SETTING,
  HIDE_DIVIDERS_SETTING,
  CARD_PANELS_SETTING,
  PANEL_RADIUS_SETTING,
  PANEL_GAP_SETTING,
} from "./constants"
import { setSettingsPluginName } from "./layoutOps"
import {
  injectGoDefaultButton,
  removeGoDefaultButton,
  setHeadbarPluginName,
} from "./headbar"
import {
  injectSidebarLayoutTab,
  removeSidebarLayoutTab,
  setSidebarPluginName,
} from "./sidebar"

let pluginName = ""
let beautifyUnsubscribe: (() => void) | null = null
let beautifySignature = ""

export async function load(name: string) {
  pluginName = name
  setupL10N(orca.state.locale, { "zh-CN": zhCN })

  await orca.plugins.setSettingsSchema(pluginName, {
    [JOURNAL_TO_TODAY_SETTING]: {
      label: t("Open layouts with today's journal"),
      description: t(
        "When a saved layout contains journal panels, applying it replaces the journal date with today. The saved layout data itself is not modified.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [SHOW_CREATE_LAYOUT_SETTING]: {
      label: t("Show the save-new-layout entry"),
      description: t(
        "Show the create/save layout input at the top of the layout tab. Turn it off to collapse this entry.",
      ),
      type: "boolean",
      defaultValue: false,
    },
    [SHOW_LAYOUT_ACTIONS_SETTING]: {
      label: t("Show layout row actions"),
      description: t(
        "Show the save/default/delete buttons on each saved layout row. Turn it off to collapse these buttons; clicking the layout name still applies it.",
      ),
      type: "boolean",
      defaultValue: false,
    },
    [SHOW_GO_DEFAULT_SETTING]: {
      label: t("Show a quick button to go to the default layout"),
      description: t(
        "Add a headbar button that applies the default layout. It falls back to today's journal when no default layout is set.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [AUTO_HIDE_SCROLLBARS_SETTING]: {
      label: t("Auto-hide scrollbars"),
      description: t(
        "Hide scrollbars by default and only show them while the mouse is hovering over the scrollable area.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [AUTO_HIDE_PANEL_ACTIONS_SETTING]: {
      label: t("Auto-hide panel action commands"),
      description: t(
        "Hide each panel's floating action buttons (e.g. outline, more menu, go buttons) until the mouse hovers over the panel.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [HIDE_DIVIDERS_SETTING]: {
      label: t("Hide panel divider lines"),
      description: t(
        "Remove the solid divider lines between panels.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [CARD_PANELS_SETTING]: {
      label: t("Card-style panels"),
      description: t(
        "Give panels a unified card look with rounded corners, gaps between panels, and spacing to the workspace edges.",
      ),
      type: "boolean",
      defaultValue: true,
    },
    [PANEL_RADIUS_SETTING]: {
      label: t("Panel card radius"),
      description: t(
        "Border radius of card-style panels, in px (recommended 10–12).",
      ),
      type: "number",
      defaultValue: 12,
    },
    [PANEL_GAP_SETTING]: {
      label: t("Panel card gap"),
      description: t(
        "Gap between card-style panels, in px (recommended 8–12).",
      ),
      type: "number",
      defaultValue: 10,
    },
  })
  setSettingsPluginName(pluginName)
  setSidebarPluginName(pluginName)
  setHeadbarPluginName(pluginName)

  injectStyles()
  applyGlobalBeautify()
  beautifyUnsubscribe = window.Valtio.subscribe(orca.state, () =>
    applyGlobalBeautify(),
  )
  injectSidebarLayoutTab()
  injectGoDefaultButton()

  console.log(`${pluginName} loaded.`)
}

export async function unload() {
  if (beautifyUnsubscribe != null) {
    beautifyUnsubscribe()
    beautifyUnsubscribe = null
  }
  removeGlobalBeautify()
  removeSidebarLayoutTab()
  removeGoDefaultButton()
  removeStyles()
  setSettingsPluginName("")
  setSidebarPluginName("")
  setHeadbarPluginName("")

  console.log(`${pluginName} unloaded.`)
}

// ---------- 全局界面美化（设置驱动） ----------

// 读取插件设置并把对应的美化类/CSS 变量写到 <html> 上。
// 各选项独立开关，切换设置后立即生效。
function applyGlobalBeautify(): void {
  const settings = orca.state.plugins[pluginName]?.settings ?? {}
  const raw = (key: string): any => settings[key]
  const sig = [
    raw(AUTO_HIDE_SCROLLBARS_SETTING),
    raw(AUTO_HIDE_PANEL_ACTIONS_SETTING),
    raw(HIDE_DIVIDERS_SETTING),
    raw(CARD_PANELS_SETTING),
    raw(PANEL_RADIUS_SETTING),
    raw(PANEL_GAP_SETTING),
  ]
    .map((v) => String(v ?? ""))
    .join("|")
  if (sig === beautifySignature) return
  beautifySignature = sig

  const boolOn = (key: string, def: boolean): boolean => {
    const v = raw(key)
    return v === undefined ? def : Boolean(v)
  }
  const num = (key: string, def: number): number => {
    const v = raw(key)
    const n = typeof v === "number" ? v : parseFloat(String(v))
    return Number.isFinite(n) ? n : def
  }
  const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, n))

  const autoHideScrollbars = boolOn(AUTO_HIDE_SCROLLBARS_SETTING, true)
  const autoHidePanelActions = boolOn(AUTO_HIDE_PANEL_ACTIONS_SETTING, true)
  const hideDividers = boolOn(HIDE_DIVIDERS_SETTING, true)
  const cardPanels = boolOn(CARD_PANELS_SETTING, true)
  const radius = clamp(num(PANEL_RADIUS_SETTING, 12), 0, 24)
  const gap = clamp(num(PANEL_GAP_SETTING, 10), 0, 24)

  const root = document.documentElement
  root.classList.toggle("orca-lm-bs-scroll", autoHideScrollbars)
  root.classList.toggle("orca-lm-bs-actions", autoHidePanelActions)
  root.classList.toggle("orca-lm-bs-hide-dividers", hideDividers)
  root.classList.toggle("orca-lm-bs-cards", cardPanels)
  root.style.setProperty("--orca-lm-panel-radius", `${radius}px`)
  root.style.setProperty("--orca-lm-panel-gap", `${gap}px`)
}

function removeGlobalBeautify(): void {
  beautifySignature = ""
  const root = document.documentElement
  root.classList.remove(
    "orca-lm-bs-scroll",
    "orca-lm-bs-actions",
    "orca-lm-bs-hide-dividers",
    "orca-lm-bs-cards",
  )
  root.style.removeProperty("--orca-lm-panel-radius")
  root.style.removeProperty("--orca-lm-panel-gap")
}

function injectStyles() {
  const styles = `
    /* 侧边栏标签行右端的「布局」标签（原生 Segmented 样式） */
    .orca-lm-tab-item {
      cursor: pointer;
    }

    /* 激活「布局」标签时隐藏官方标签内容区（收藏/标签/页面视图） */
    nav#sidebar.orca-lm-active .orca-sidebar-tabs {
      display: none !important;
    }

    /* 侧边栏内的布局管理列表 */
    .orca-lm-sidebar-content {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: var(--orca-spacing-sm);
      /* 行高亮宽度与上方「收藏/标签/页面」标签栏一致 */
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow-y: auto;
      font-family: var(--orca-fontfamily-ui);
      font-size: var(--orca-fontsize-sm);
      color: var(--orca-color-text-1);
      user-select: none;
    }
    .orca-lm-save-row {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 0 var(--orca-spacing-xl);
    }
    .orca-lm-input {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      box-sizing: border-box;
      border-radius: var(--orca-radius-md);
      border: 1px solid var(--orca-color-border);
      background: var(--orca-color-bg-2);
      color: var(--orca-color-text-1);
      font-size: var(--orca-fontsize-sm);
      font-family: var(--orca-fontfamily-ui);
      outline: none;
      user-select: text;
    }
    .orca-lm-overwrite-row {
      display: none;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding: 6px var(--orca-spacing-xl);
      border-radius: var(--orca-radius-md);
      background: var(--orca-color-gray-1);
      color: var(--orca-color-text-2);
      font-size: var(--orca-fontsize-2xs);
    }
    .orca-lm-empty {
      color: var(--orca-color-text-2);
      font-size: var(--orca-fontsize-sm);
      padding: var(--orca-spacing-sm) var(--orca-spacing-xl);
    }
    .orca-lm-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      /* 布局行没有图标/标签列，不再预留图标列缩进 */
      padding: 0;
    }
    .orca-lm-layout-row {
      display: flex;
      align-items: center;
      gap: 4px;
      /* 行背景铺满左右，文字缩进由行自身内边距提供 */
      padding: var(--orca-spacing-xs) var(--orca-spacing-xl);
      border-radius: var(--orca-radius-sm);
      cursor: pointer;
    }
    .orca-lm-layout-row:hover {
      background: var(--orca-color-selection);
    }
    .orca-lm-layout-name {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .orca-lm-layout-name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .orca-lm-row-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    /* 行尾的默认布局实心星星 */
    .orca-lm-default-star {
      flex-shrink: 0;
      color: var(--orca-color-text-yellow);
      font-size: var(--orca-fontsize-md);
    }
    .orca-lm-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      border-radius: var(--orca-radius-sm);
      color: var(--orca-color-text-2);
      cursor: pointer;
      font-size: var(--orca-fontsize-md);
      line-height: 1;
    }
    .orca-lm-btn:hover {
      color: var(--orca-color-text-1);
      background-color: var(--orca-color-gray-5);
    }
    .orca-lm-btn-primary {
      width: auto;
      height: 26px;
      gap: 4px;
      padding: 0 10px;
      background: var(--orca-color-primary-5);
      color: var(--orca-color-white);
      font-size: var(--orca-fontsize-sm);
    }
    .orca-lm-btn-primary:hover {
      background: var(--orca-color-primary-6);
      color: var(--orca-color-white);
    }
    .orca-lm-btn-danger {
      color: var(--orca-color-dangerous-5);
    }
    .orca-lm-btn-danger:hover {
      background-color: var(--orca-color-gray-5);
    }
    .orca-lm-btn:disabled {
      opacity: .4;
      cursor: not-allowed;
    }
    .orca-lm-btn-text {
      width: auto;
      padding: 0 8px;
      height: 22px;
      font-size: var(--orca-fontsize-xs);
    }
    .orca-lm-overwrite-hint {
      color: var(--orca-color-text-2);
      font-size: var(--orca-fontsize-2xs);
    }

    /* ---------- 全局界面美化（设置开关控制，默认开启） ---------- */

    /* 1. 自动隐藏滚动条：默认透明，鼠标悬停/键盘聚焦可滚动区域时显示 */
    .orca-lm-bs-scroll *::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .orca-lm-bs-scroll *::-webkit-scrollbar-track {
      background: transparent;
    }
    .orca-lm-bs-scroll *::-webkit-scrollbar-thumb {
      background-color: transparent !important;
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    .orca-lm-bs-scroll *:hover::-webkit-scrollbar-thumb,
    .orca-lm-bs-scroll *:focus-within::-webkit-scrollbar-thumb {
      background-color: var(--orca-color-win-scrollbar) !important;
    }

    /* 2. 自动隐藏面板操作命令：鼠标悬停/聚焦面板时显示 */
    .orca-lm-bs-actions .orca-panel .orca-block-editor-sidetools,
    .orca-lm-bs-actions .orca-panel .orca-panel-drag-handle,
    .orca-lm-bs-actions .orca-panel .orca-block-editor-go-btn {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }
    .orca-lm-bs-actions .orca-panel:hover .orca-block-editor-sidetools,
    .orca-lm-bs-actions .orca-panel:hover .orca-panel-drag-handle,
    .orca-lm-bs-actions .orca-panel:hover .orca-block-editor-go-btn,
    .orca-lm-bs-actions .orca-panel:focus-within .orca-block-editor-sidetools,
    .orca-lm-bs-actions .orca-panel:focus-within .orca-panel-drag-handle,
    .orca-lm-bs-actions .orca-panel:focus-within .orca-block-editor-go-btn {
      opacity: 1;
      pointer-events: auto;
    }

    /* 3. 隐藏面板间纯色分割实线（独立开关） */
    .orca-lm-bs-hide-dividers
      .orca-panels-row
      > :is(.orca-panels-column, .orca-panel):not(:last-child),
    .orca-lm-bs-hide-dividers
      .orca-panels-column
      > :is(.orca-panels-row, .orca-panel):not(:last-child) {
      border-right: none !important;
      border-bottom: none !important;
    }

    /* 4. 卡片化面板：统一圆角 + 面板间缝隙，
       自带背景色差（容器次级背景/面板主背景）与柔和投影 */
    /* 容器（#main）四周按同样间距缩进，卡片与工作区边缘留白，
       避免只有面板之间有空隙而上下边缘贴边造成的割裂感 */
    .orca-lm-bs-cards .orca-panels-container {
      background: var(--orca-color-bg-2);
      padding: var(--orca-lm-panel-gap);
    }
    .orca-lm-bs-cards .orca-panels-row,
    .orca-lm-bs-cards .orca-panels-column {
      background: var(--orca-color-bg-2);
      gap: var(--orca-lm-panel-gap);
    }
    .orca-lm-bs-cards .orca-panels-container .orca-panel {
      border-radius: var(--orca-lm-panel-radius);
      background: var(--orca-color-bg-1);
      box-shadow: var(--orca-shadow-sidebar);
    }
  `

  const styleEl = document.createElement("style")
  styleEl.dataset.role = pluginName
  styleEl.innerHTML = styles
  document.head.appendChild(styleEl)
}

function removeStyles() {
  const styleEls = document.querySelectorAll(`style[data-role="${pluginName}"]`)
  styleEls.forEach((el) => el.remove())
}
