# X Screenshot

[English](./README.md)

一个用于截取 X (Twitter) 推文的 Chrome 插件，支持自定义样式。

## 功能特性

- **多选** - 一次选中多条推文
- **自定义 CSS** - 隐藏不需要的元素（如 Grok 按钮等）
- **时间格式化** - 将相对时间转换为绝对时间格式
- **下载或复制** - 保存为 PNG 或复制到剪贴板

## 安装

### 从 Chrome Web Store 安装

即将上线。

### 手动安装

1. 克隆此仓库
2. 安装依赖：`pnpm install`
3. 构建：`pnpm build`
4. 在 Chrome 中打开 `chrome://extensions/`
5. 开启「开发者模式」
6. 点击「加载已解压的扩展程序」，选择 `.output/chrome-mv3` 文件夹

## 使用方法

1. 打开 X (twitter.com)
2. 点击插件图标
3. （可选）配置自定义 CSS 或时间格式化
4. 点击「Start」
5. 鼠标悬停在推文上 - 蓝色遮罩表示可选
6. 点击选中 - 绿色遮罩表示已选
7. 在最后一条选中的推文上点击「Done」
8. 下载或复制截图

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（支持 HMR）
pnpm dev

# 运行测试
pnpm test

# 生产构建
pnpm build
```

## 技术栈

- [WXT](https://wxt.dev/) - 现代 Chrome 插件框架
- [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/) - 样式
- [Vitest](https://vitest.dev/) - 测试
- Chrome `captureVisibleTab` API - 截图捕获

## 许可证

MIT
