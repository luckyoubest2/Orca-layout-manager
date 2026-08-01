import { t } from "./libs/l10n"
import { applyDefaultLayout } from "./layoutOps"
import { SHOW_GO_DEFAULT_SETTING } from "./constants"

const BUTTON_CLASS = "orca-lm-go-default-btn"

let settingsPluginName = ""
let injected = false
let observer: MutationObserver | null = null
let unsubscribe: (() => void) | null = null
let button: HTMLButtonElement | null = null

export function setHeadbarPluginName(name: string): void {
  settingsPluginName = name
}

function showGoDefaultButton(): boolean {
  return (
    orca.state.plugins[settingsPluginName]?.settings?.[
      SHOW_GO_DEFAULT_SETTING
    ] !== false
  )
}

// 在顶栏全局工具区新增一个独立的「前往默认布局」按钮（不替换官方按钮）。
// 按钮放在「前往今日日志」旁边，点击应用默认布局；未设置默认布局时回退到今日日志。
export function injectGoDefaultButton(): void {
  injected = true
  ensureApplied()

  if (observer == null) {
    // 顶栏重渲染可能移除按钮，自动恢复
    observer = new MutationObserver(() => ensureApplied())
    observer.observe(document.body, { childList: true, subtree: true })
  }

  if (unsubscribe == null) {
    // 设置面板切换开关时立即显示/隐藏
    unsubscribe = window.Valtio.subscribe(orca.state, () => {
      if (showGoDefaultButton()) ensureApplied()
      else removeButton()
    })
  }
}

export function removeGoDefaultButton(): void {
  injected = false
  if (observer != null) {
    observer.disconnect()
    observer = null
  }
  if (unsubscribe != null) {
    unsubscribe()
    unsubscribe = null
  }
  removeButton()
}

function ensureApplied(): void {
  if (!injected || !showGoDefaultButton()) return
  if (button != null && button.isConnected) return

  const tools = document.querySelector<HTMLElement>(".orca-headbar-global-tools")
  if (tools == null) return

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = `orca-button plain ${BUTTON_CLASS}`
  btn.title = t("Go to the default layout")
  btn.setAttribute("aria-label", t("Go to the default layout"))
  const icon = document.createElement("i")
  icon.className = "ti ti-layout-filled orca-headbar-icon"
  btn.appendChild(icon)
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    void applyDefaultLayout()
  })
  btn.addEventListener("mousedown", (e) => e.stopPropagation())

  // 优先放在「前往今日日志」按钮旁边，找不到时追加到工具区末尾
  const homeIcon = tools.querySelector<HTMLElement>("i.ti-home.orca-headbar-icon")
  const homeBtn = homeIcon?.closest("button")
  if (homeBtn != null) homeBtn.after(btn)
  else tools.appendChild(btn)

  button = btn
}

function removeButton(): void {
  if (button != null) {
    button.remove()
    button = null
  }
}
