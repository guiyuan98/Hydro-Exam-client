# GYOJ Qt 原生客户端原型

这是早期 Qt/C++ 原生客户端原型，可作为毕业论文中“原生客户端实现方案”的参考。当前可交付学生端以 `client/oj-shell` 为主，因为它已经完成打包、默认考试模式、Hydro 页面嵌入和本地样例运行。

原型能力：

- 嵌入 Hydro OJ 页面。
- 提供 C++ 编辑器和本地样例运行。
- 预留全屏、剪贴板、进程黑名单等监考控制器。
- 预留远程提交接口。

默认服务地址：

```json
{
  "serverBaseUrl": "http://192.168.1.149"
}
```

后续如果继续走 Qt 路线，建议使用 QWebEngine 嵌入 Hydro 页面，使用 QScintilla/Scintilla 完善编辑器体验，并把监考审计接入 Hydro 插件 API。

