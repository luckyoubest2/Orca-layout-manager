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

// 插件设置键：是否把顶栏「前往今日日志」按钮替换为「前往默认布局」
export const REPLACE_GO_TODAY_SETTING = "replaceGoTodayWithDefaultLayout"
