import { setupL10N, t } from "./libs/l10n"
import zhCN from "./translations/zhCN"
import {
  JOURNAL_TO_TODAY_SETTING,
  SHOW_CREATE_LAYOUT_SETTING,
  SHOW_LAYOUT_ACTIONS_SETTING,
} from "./constants"
import { setSettingsPluginName } from "./layoutOps"
import {
  injectSidebarLayoutTab,
  removeSidebarLayoutTab,
  setSidebarPluginName,
} from "./sidebar"

let pluginName = ""

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
      defaultValue: true,
    },
    [SHOW_LAYOUT_ACTIONS_SETTING]: {
      label: t("Show layout row actions"),
      description: t(
        "Show the save/default/delete buttons on each saved layout row. Turn it off to collapse these buttons; clicking the layout name still applies it.",
      ),
      type: "boolean",
      defaultValue: true,
    },
  })
  setSettingsPluginName(pluginName)
  setSidebarPluginName(pluginName)

  injectStyles()
  injectSidebarLayoutTab()

  console.log(`${pluginName} loaded.`)
}

export async function unload() {
  removeSidebarLayoutTab()
  removeStyles()
  setSettingsPluginName("")
  setSidebarPluginName("")

  console.log(`${pluginName} unloaded.`)
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
      gap: 8px;
      padding: var(--orca-spacing-lg) var(--orca-spacing-md);
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
      padding: 6px 8px;
      border-radius: var(--orca-radius-md);
      background: var(--orca-color-gray-1);
      color: var(--orca-color-text-2);
      font-size: var(--orca-fontsize-2xs);
    }
    .orca-lm-actions-row {
      display: flex;
    }
    .orca-lm-divider {
      height: 1px;
      background: var(--orca-color-border);
    }
    .orca-lm-subtitle {
      font-weight: 600;
      font-size: var(--orca-fontsize-sm);
    }
    .orca-lm-empty {
      color: var(--orca-color-text-2);
      font-size: var(--orca-fontsize-sm);
      padding: 4px 0;
    }
    .orca-lm-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .orca-lm-layout-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 6px;
      border-radius: var(--orca-radius-md);
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
    .orca-lm-badge {
      padding: 1px 6px;
      border-radius: var(--orca-radius-sm);
      background: var(--orca-color-primary-5);
      color: var(--orca-color-white);
      font-size: 11px;
      flex-shrink: 0;
    }
    .orca-lm-row-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
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
