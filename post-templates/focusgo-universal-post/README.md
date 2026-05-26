# Focus&Go Universal Post Template

通用内容海报模板。目标是写完 post 后只填内容，不再手工排版。

## Size

- Canvas: `1080 x 1350`
- Ratio: `4:5`
- Background: `#F5F3F0`
- Near-black text: `#3A3733`

## Layouts

Set `layout` in `window.POST_DATA`:

- `image`: 标题 + 摘要 + 产品/截图/配图
- `quote`: 标题 + 摘要 + 金句卡片
- `list`: 标题 + 摘要 + 3 个行动点

## Replaceable Data

Edit `window.POST_DATA` at the bottom of `index.html`:

```js
window.POST_DATA = {
  layout: "image",
  kicker: "第一版",
  title: "先让开始\n变得容易一点",
  summary: "Focus&Go 是一个低阻力执行系统。\n从任务、专注、记录到复盘，\n把一天放回一个安静的界面里。",
  quote: "真正的问题不是不努力，\n而是开始的阻力太高。",
  points: ["写下今天要推进的事", "打开专注而不是切换工具", "结束后自动进入复盘"],
  brandName: "Focus&Go",
  brandTagline: "低阻力执行系统",
  ctaLabel: "访问官网",
  cta: "WWW.NESTFLOW.ART",
  logo: "./assets/focusgo-logo.png",
  image: "./assets/product-preview.jpg",
};
```

## URL Parameters

You can also generate variants from the URL:

```text
/?layout=quote&title=先让开始变得容易一点&summary=减少阻力，比增加意志力更重要&quote=真正的问题不是不努力，而是开始的阻力太高。
```

For list layout, split `points` with `|`:

```text
/?layout=list&points=写下今天要推进的事|打开专注|结束后复盘
```

## Export

Open `index.html` in a browser and screenshot/export the `.poster` area at `1080 x 1350`.
