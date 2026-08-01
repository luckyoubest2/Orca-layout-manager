// 内部常量：布局数据键与同步广播名。
// 与官方实现保持一致（RepoKeys.PanelLayouts = 1002）。
export const PANEL_LAYOUTS_KEY = 1002
export const REFRESH_SETTINGS_BROADCAST = "orca.refresh-settings"

// 插件设置键：应用布局时是否把日志面板日期改为今日
export const JOURNAL_TO_TODAY_SETTING = "journalToTodayOnApply"

// 插件设置键：是否显示「保存新布局」入口（创建布局命令）
export const SHOW_CREATE_LAYOUT_SETTING = "showCreateLayout"

// 插件设置键：是否显示每个布局行的 保存/默认/删除 操作按钮
export const SHOW_LAYOUT_ACTIONS_SETTING = "showLayoutActions"

// 插件设置键：是否显示顶栏「前往默认布局」快捷按钮
export const SHOW_GO_DEFAULT_SETTING = "showGoDefaultButton"

// 插件设置键：是否自动隐藏滚动条（鼠标靠近时显示）
export const AUTO_HIDE_SCROLLBARS_SETTING = "beautifyAutoHideScrollbars"

// 插件设置键：是否自动隐藏面板操作命令（鼠标悬停面板时显示）
export const AUTO_HIDE_PANEL_ACTIONS_SETTING = "beautifyAutoHidePanelActions"

// 插件设置键：是否隐藏面板间的分割实线
export const HIDE_DIVIDERS_SETTING = "beautifyHideDividers"

// 插件设置键：是否启用卡片化面板
export const CARD_PANELS_SETTING = "beautifyCardPanels"

// 插件设置键：卡片化面板的圆角（像素）
export const PANEL_RADIUS_SETTING = "beautifyPanelRadius"

// 插件设置键：卡片化面板之间的间距（像素）
export const PANEL_GAP_SETTING = "beautifyPanelGap"
