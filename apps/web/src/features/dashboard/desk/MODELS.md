# 顶栏桌面模型 — 2026-10-15

本轮按用户要求，先下载并打开成品 3D 模型文件，再决定直接采用或参考重建。
保持纯侧面摄影机、分隔线桌面、自由摆放、无限制重复添加，以及独立交互。
用户尚未验收本轮视觉；本轮仅提交代码，未推送或上线。
2026-10-15 用户决定移除猫：删除入口、模型与资源，旧配置中的猫自动移除，其余物件保留。

## 实际采用与参考

| 物件 | 已打开的成品文件 / 作者 | 本轮采用方式 |
|---|---|---|
| 笔记本 | [Laptop / MacBook Pro / Alex Safayan](https://poly.pizza/m/27hcX_w47Jb)，CC BY 3.0 | 直接采用底座、键盘、触控板、外壳和盖板网格；重设铰链原点与闭合硬限位，增加屏幕内容和打字线。 |
| 打字机 | [Typewriter / Pat Siefring](https://poly.pizza/m/0wEEWpFFmdd)，CC BY 3.0 | 直接采用分件网格；按键、滚筒、压纸杆和字车重新分组，增加纸张、字迹及回车。 |
| 蜡烛 | [Candle Melted / Kay Lousberg](https://poly.pizza/m/tFTUlbLC3Q)，CC0 | 直接采用不对称融蜡边缘、蜡体和灯芯；增加托盘、火焰、烟和真实时间燃烧。 |
| 台灯 | [Desk Lamp Arm 01 / Kuutti Siitonen](https://polyhaven.com/a/desk_lamp_arm_01)，CC0，glTF + bin | 参考成品的双杆、弹簧、转轴和灯罩结构重建；来源 glTF 未携带可用骨架，维持原有独立铰链控制。另核对 [Anglepoise 1227](https://support.anglepoise.com/hc/en-gb/articles/360014507657-Anglepoise-Original-1227-Desk-Lamp)。 |
| 书 | [Open Book / Quaternius](https://poly.pizza/m/JEDMpG0UIR)，CC0，GLB | 原文件为静态页块，不能直接翻页；参考封面/页块分层，重建缝装书脊、曲面页块与完整可弯曲的翻动书页。 |
| 唱片机 | [Record Player / Ginsta](https://poly.pizza/m/uaz6praPQc)，CC BY 3.0，GLB | 下载文件是粗多边形水平唱盘，作为部件关系参考；按 [Pro-Ject VT-E](https://www.project-audio.com/en/product/vt-e/) 重建竖式三角机身、背撑、唱臂配重、针头与同心唱槽。唱针落在有效唱槽区。 |
| 咖啡 | [Cup Tea / Kenney](https://poly.pizza/m/M2sVC8jbmi)，CC0，GLB | 来源低面数杯体不直接用于最终效果；参考杯口、杯柄、液面关系，重建圆滑双层杯壁、连接完整的管状杯柄与碟子。蒸汽保持细铅笔线。 |
| 冰可乐 | [Soda Glass / Kenney](https://poly.pizza/m/GL1psXgIRp)，CC0，GLB | 参考杯体/液面/吸管分件，重建透明薄杯壁、双层杯口、厚底、圆角冰块及杯内气泡；不采用来源的柠檬片和八边形轮廓。 |
| 绿植 | [Fiddle-leaf Plant / Poly by Google](https://poly.pizza/m/2ag6_uuqsnb)，CC BY 3.0，GLB；[Potted Plant 04](https://polyhaven.com/a/potted_plant_04)，CC0，glTF | 核对茎叶连接、盆口、土面和真实体积，保留可独立摇动的分枝与叶片；重建立体叶片、叶脉和土面，修正浇水重复施力。 |
| 计时器 | [Timer / scaranto](https://poly.pizza/m/wZOaCBBiJ9)，CC0，GLB | 下载文件实际为秒表，与现有番茄旋转计时器不同，未直接采用。按[实物番茄计时器](https://www.sisco.com/tomato-kitchen-timer)重建上下壳、旋转数字刻度、固定指示标和顶梗。 |

“参考重建”不表示使用了来源网格；这些参考文件不进入生产包。
原始来源的许可与作者署名不因代码仓库的 MIT 许可而改变。
分发署名：[public/licenses/desk-models.txt](../../../../public/licenses/desk-models.txt)，选择器中可打开。

## 文件与资源生命周期

- 运行时只加载仓库内三个版本化 GLB，不依赖第三方 CDN 或模型平台。
- 共约 0.56 MB，随桌面场景延迟加载；同一页面共享只读源缓存，克隆实例持有各自几何、材质与交互状态。
- 移除一个实例不会释放其他实例或源缓存。
- PWA 预缓存包含 GLB 和署名文件，避免离线刷新后缺失模型。
- 笔记本从闭合坐标系绕真实后沿转动；灯罩碰撞检查覆盖外壳截面，光束由最终世界矩阵计算。
- 计时器与蜡烛采用墙上时钟；拖动取消恢复原位置和灯姿态。

原始文件 SHA-256（改编发生于加载后的几何/材质，不改写文件）：

```
laptop.glb     8a0bcd9f69b13e7cfc17bd326b04a4f6a18a6d0dc7d253f4c6208fe554121c10
typewriter.glb b667985000798330cb183572a15e236d66b1c72d80c2746ffc7d40037ffd717d
candle.glb     5545bef3d89d3b5a1cd8b057535fc6be9590b63dfb107e4cee26439aebe83994
```

## 可复核预览与检查

开发服务器下：

- `/`：实际 dashboard，悬停控件打开物件选择器。
- `/e2e/fixtures/desk-models.html`：10 个实际模型（含台灯），侧面/斜侧面、昼夜和交互。
- `/e2e/fixtures/desk-sources.html`：三个采用的原始 GLB，可旋转比较原始材质与描边。

```
npm exec -- vitest run src/features/dashboard src/shared/three
npm exec -- playwright test --config playwright.desk.config.ts
npm run lint
npm run build
```

2026-10-15 本机验证：122 条相关单元测试、5 条 Chromium 浏览器回归、全量 Web lint 和生产构建通过。
浏览器覆盖模型渲染/主题/交互、蜡烛拖动与取消/重开保存、全类别添加与重复蜡烛、缩窗、减少动态计时、灯臂拖动保存。
浏览器验证使用本机 Chromium + Metal；Safari、Firefox 与 Tauri 安装包未在本轮验收。
截图保存在本地 `.artifacts/desk-models-*.png`、`.artifacts/desk-dashboard-*.png` 和 `.artifacts/desk-lamp-moved.png`。
