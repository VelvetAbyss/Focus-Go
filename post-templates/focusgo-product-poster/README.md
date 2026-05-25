# Focus&Go Product Poster Template

Static HTML post template for Focus&Go social assets.

## Size

- Canvas: `1080 x 1350`
- Ratio: `4:5`
- Background: `#F5F3F0`
- Near-black text: `#3A3733`

## Replaceable Data

Edit `window.POST_DATA` at the bottom of `index.html`:

```js
window.POST_DATA = {
  headline: "为什么任务软件\n越强大，\n我越不想打开？",
  subcopy: "回归专注本质，\n让行动自然发生。",
  brandName: "Focus&Go",
  brandTagline: "专注 · 行动 · 成长",
  logo: "./assets/focusgo-logo.png",
  productImage: "./assets/product-preview.jpg",
};
```

Use line breaks in `headline` and `subcopy` to control typesetting. Replace `logo` and `productImage` with any local or compiled asset path.

## Preview

Open `index.html` directly in a browser, or serve this folder with any static server when rendering/exporting screenshots.
