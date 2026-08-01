import { applyDefaultLayout } from "./layoutOps"
import { REPLACE_GO_TODAY_SETTING } from "./constants"

const HOME_ICON_CLASS = "ti-home"
const DEFAULT_ICON_CLASS = "ti-layout-filled"
const HOME_BUTTON_SELECTOR =
  ".orca-headbar-global-tools i.ti-home.orca-headbar-icon"

// 工具提示文案替换：前往今日日志 → 前往默认布局
const TOOLTIP_REWRITES: Record<string, string> = {
  "Go to today's journal": "Go to the default layout",
  "前往今日日志": "前往默认布局",
}

let settingsPluginName = ""
let injected = false
let observer: MutationObserver | null = null
let unsubscribe: (() => void) | null = null
let button: HTMLButtonElement | null = null
let clickHandler: ((e: Event) => void) | null = null

export function setHeadbarPluginName(name: string): void {
  settingsPluginName = name
}

function goDefaultEnabled(): boolean {
  return (
    orca.state.plugins[settingsPluginName]?.settings?.[
      REPLACE_GO_TODAY_SETTING
    ] !== false
  )
}

// 把顶栏「前往今日日志」按钮替换为「前往默认布局」：
// - 更换图标（ti-home → ti-layout-filled）；
// - 用捕获阶段的点击监听拦截原生事件，阻止 React 原有 onClick 触发，
//   改为应用默认布局；
// - 悬停时把 Tooltip 文案改为「前往默认布局」。
export function injectGoDefaultButton(): void {
  injected = true
  ensureApplied()
  rewriteTooltip()

  if (observer == null) {
    observer = new MutationObserver(() => {
      ensureApplied()
      rewriteTooltip()
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  if (unsubscribe == null) {
    // 设置面板切换开关时立即生效（恢复或重新替换按钮）
    unsubscribe = window.Valtio.subscribe(orca.state, () => {
      if (goDefaultEnabled()) ensureApplied()
      else resetButton()
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
  resetButton()
}

function ensureApplied(): void {
  if (!injected || !goDefaultEnabled()) return
  const btn = findHomeButton()
  if (btn == null || btn === button) return

  resetButton()
  const icon = btn.querySelector<HTMLElement>("i.ti-home")
  if (icon != null) {
    icon.classList.remove(HOME_ICON_CLASS)
    icon.classList.add(DEFAULT_ICON_CLASS)
  }
  const handler = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    void applyDefaultLayout()
  }
  btn.addEventListener("click", handler, true)
  button = btn
  clickHandler = handler
}

function resetButton(): void {
  if (button == null) return
  if (clickHandler != null) {
    button.removeEventListener("click", clickHandler, true)
    clickHandler = null
  }
  const icon = button.querySelector<HTMLElement>("i")
  if (icon != null) {
    icon.classList.add(HOME_ICON_CLASS)
    icon.classList.remove(DEFAULT_ICON_CLASS)
  }
  button = null
}

function findHomeButton(): HTMLButtonElement | null {
  const icon = document.querySelector<HTMLElement>(HOME_BUTTON_SELECTOR)
  return (icon?.closest("button") as HTMLButtonElement | null) ?? null
}

function rewriteTooltip(): void {
  if (!injected) return
  for (const el of document.querySelectorAll<HTMLElement>(".orca-tooltip")) {
    const current = tooltipText(el)
    const target = TOOLTIP_REWRITES[current]
    if (target != null) setTooltipText(el, target)
  }
}

function tooltipText(el: HTMLElement): string {
  const shortcut = el.querySelector(".orca-tooltip-shortcut")
  if (shortcut != null) {
    const textEl = el.firstElementChild
    return textEl != null ? (textEl.textContent ?? "").trim() : ""
  }
  return (el.textContent ?? "").trim()
}

function setTooltipText(el: HTMLElement, text: string): void {
  const shortcut = el.querySelector(".orca-tooltip-shortcut")
  if (shortcut != null) {
    const textEl = el.firstElementChild
    if (textEl != null && textEl !== shortcut) textEl.textContent = text
  } else {
    el.textContent = text
  }
}
