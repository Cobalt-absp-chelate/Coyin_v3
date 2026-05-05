# Coyin v3

`知页` 桌面应用源码仓库，基于 `Vite + React + Tauri 2`。

## 开发

```bash
npm install
npm run tauri:dev
```

## 构建

```bash
npm run build
npm run tauri:build
```

## 发布产物

- 可执行文件：`src-tauri/target/release/知页.exe`
- 安装器：`src-tauri/target/release/bundle/nsis/知页_0.1.0_x64-setup.exe`

源码提交到仓库，编译产物建议上传到 GitHub Releases。
