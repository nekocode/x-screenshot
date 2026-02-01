# Architecture

> x-screenshot: 推文截图 Chrome 插件

## 目录结构

```
x-screenshot/
├── entrypoints/
│   ├── popup/              # 插件弹窗
│   │   ├── index.html      # 弹窗 HTML 入口
│   │   ├── main.ts         # 弹窗逻辑（设置 + 启动）
│   │   └── style.css       # 弹窗样式
│   ├── content.ts          # 内容脚本入口（协调器）
│   └── background.ts       # 后台脚本（captureVisibleTab）
├── lib/
│   ├── selector.ts         # 选择模式控制器 + eager capture
│   ├── capture.ts          # 截图核心（分段截图 + 拼接）
│   └── modal.ts            # 结果弹窗（下载/复制）
├── tests/                  # 单元测试
│   ├── capture.test.ts
│   ├── modal.test.ts
│   └── selector.test.ts
├── wxt.config.ts           # WXT 配置
├── vitest.config.ts        # 测试配置
├── package.json
└── tsconfig.json
```

## 模块职责

| 模块 | 职责 |
|------|------|
| `popup/main.ts` | 设置界面（自定义 CSS、时间格式化），启动选择模式 |
| `background.ts` | 调用 Chrome captureVisibleTab API，返回截图 data URL |
| `content.ts` | 消息路由，协调 selector → modal 流程 |
| `selector.ts` | hover 高亮、click 选中、**选中时立即截图**、Done/Cancel 按钮 |
| `capture.ts` | 注入 CSS 隐藏干扰元素、分段截图（超高元素）、垂直拼接 |
| `modal.ts` | 展示结果图片，下载/复制到剪贴板 |

## 数据流

```
[点击插件] → [popup 发消息] → [content 进入选择模式]
       ↓
[hover 显示蓝色遮罩+相机图标]
       ↓
[click 选中] → [立即截图 (eager capture)]
       ↓                    ↓
       ↓            content → background (captureVisibleTab)
       ↓                    ↓
       ↓            [裁剪/分段拼接] → [缓存 data URL]
       ↓
[显示绿色遮罩 + Done/Cancel]
       ↓
[点击 Done] → [拼接所有缓存图片] → [modal 展示]
```

### 为什么 eager capture？

Twitter 使用虚拟列表（Virtual List），滚动时会回收 DOM 节点。如果等到最后批量截图，之前选中的 tweet 可能已经被销毁。因此**选中时立即截图**，缓存 data URL。

## 技术选型

| 技术 | 理由 |
|------|------|
| WXT | 现代 Chrome 插件框架，支持 HMR |
| captureVisibleTab | Chrome 原生 API，无跨域限制，精确像素级截图 |
| Canvas 裁剪拼接 | 支持超高元素分段截图，灵活控制输出 |
| data-testid 选择器 | X 类名不稳定，testid 更可靠 |
| Vitest | 快速，与 Vite 生态集成 |

## 截图流程细节

### 截图前的准备

1. **暂停选择模式** - 防止 hover 事件干扰
2. **注入 CSS** - 隐藏 overlay、禁用 pointer-events、移除 tweet hover 背景
3. **隐藏 sticky/fixed 元素** - 防止 header 遮挡
4. **清除所有 tweet outline** - 避免选中框出现在截图中
5. **格式化时间** - 可选，将相对时间转为 `yyyy/MM/dd HH:mm`

### 分段截图（超高元素）

当 tweet 高度超过视口时，分段滚动截图，最后垂直拼接。

### 自定义 CSS（用户可配置）

截图前注入的 CSS，用于隐藏不需要的元素：

```css
button[aria-label="Grok actions"] {
  display: none !important;
}
```

## 使用方式

1. 打开 X (twitter.com)
2. 点击插件图标
3. 点击 "Start Selection"
4. hover 推文显示蓝色虚线 + 浅蓝遮罩 + 相机图标
5. click 选中显示绿色虚线 + 浅绿遮罩
6. 点击最后选中推文上的 "Done" 按钮
7. 弹窗展示拼接后的截图
8. 下载或复制到剪贴板
