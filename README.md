# Flomo 整理器

一个移动端优先、可安装的 PWA：粘贴 Markdown 表格或 Excel/飞书复制出的制表符内容，自动整理成一行一条的 Flomo 备忘录。

## 主要能力

- Markdown 表格与制表符表格自动解析
- 保留原表头，支持单行、分行、Markdown 三种格式
- 逐条或合并发送到 Flomo
- 发送结果显示与失败重试
- API 地址仅保存在当前浏览器 localStorage
- 离线打开与添加到手机主屏幕

## 本地运行

```bash
npm install
npm run dev
```

## GitHub Pages 部署

1. 将项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings → Pages 中，将 Source 设为 **GitHub Actions**。
3. 后续每次推送都会自动构建和发布。

> Flomo API 请求从浏览器直接发出。如果 Flomo 后续改变跨域策略，可能需要增加同域代理。
