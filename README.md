# X Screenshot

[中文文档](./README_CN.md)

A Chrome extension for capturing tweets from X (Twitter) with custom styles.

## Features

- **Multi-select** - Select multiple tweets at once
- **Custom CSS** - Hide unwanted elements (Grok button, etc.)
- **Time formatting** - Convert relative time to absolute format
- **Download or copy** - Save as PNG or copy to clipboard

## Installation

### From Chrome Web Store

Coming soon.

### Manual Installation

1. Clone this repository
2. Install dependencies: `pnpm install`
3. Build: `pnpm build`
4. Open `chrome://extensions/` in Chrome
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `.output/chrome-mv3` folder

## Usage

1. Open X (twitter.com)
2. Click the extension icon
3. (Optional) Configure custom CSS or time formatting
4. Click "Start"
5. Hover over tweets - blue overlay indicates selectable
6. Click to select - green overlay indicates selected
7. Click "Done" on the last selected tweet
8. Download or copy the screenshot

## Development

```bash
# Install dependencies
pnpm install

# Development mode with HMR
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Tech Stack

- [WXT](https://wxt.dev/) - Modern Chrome extension framework
- [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/) - Styling
- [Vitest](https://vitest.dev/) - Testing
- Chrome `captureVisibleTab` API - Screenshot capture

## License

MIT
