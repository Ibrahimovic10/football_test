# 绿茵快讯

一个带 Python 后端的本地足球资讯演示网站。后端只使用 Python 标准库，不需要安装第三方依赖。

## 本地运行

需要 Python 3.9 或更高版本。在项目目录执行：

```bash
python3 server.py
```

然后访问 <http://127.0.0.1:8000>。

如需修改监听地址或端口：

```bash
python3 server.py --host 0.0.0.0 --port 8080
```

## 后端接口

- `GET /api/health`：服务健康检查
- `GET /api/search?q=关键词`：站内搜索
- `GET /api/comments`：读取本地评论
- `POST /api/comments`：发表评论，请求体格式为 `{"content": "评论内容"}`

评论保存在 `data/comments.json` 中，适合本地演示和学习使用。
