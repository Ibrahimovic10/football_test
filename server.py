#!/usr/bin/env python3
"""绿茵快讯本地开发服务器。

仅使用 Python 标准库，同时提供静态文件和简单 JSON API。
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


BASE_DIR = Path(__file__).resolve().parent
COMMENTS_FILE = BASE_DIR / "data" / "comments.json"
COMMENTS_LOCK = threading.Lock()

SEARCH_ITEMS = [
    {
        "title": "拜仁慕尼黑专区：红色信仰与观赛笔记",
        "url": "/index.html#bayern",
        "keywords": "拜仁 慕尼黑 南部之星 凯恩 德甲 Mia san mia Bayern",
    },
    {
        "title": "梅西专区：左脚、视野与足球之美",
        "url": "/index.html#messi",
        "keywords": "梅西 Messi 阿根廷 盘带 直塞 十号",
    },
    {
        "title": "从重金属到控制流：高位逼抢战术的十年进化",
        "url": "/article.html",
        "keywords": "克洛普 利物浦 斯洛特 战术 高位逼抢 英超",
    },
    {
        "title": "最新足球赛程",
        "url": "/matches.html",
        "keywords": "赛程 比分 英超 西甲 意甲 德甲 法甲 中超",
    },
    {
        "title": "五大联赛积分榜",
        "url": "/standings.html",
        "keywords": "积分榜 排名 英超 西甲 意甲 德甲 法甲",
    },
    {
        "title": "绿茵快讯首页",
        "url": "/index.html",
        "keywords": "足球 新闻 转会 欧冠 国家队",
    },
]


def read_comments() -> list[dict[str, Any]]:
    if not COMMENTS_FILE.exists():
        return []
    try:
        data = json.loads(COMMENTS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def write_comments(comments: list[dict[str, Any]]) -> None:
    COMMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(
        prefix="comments-", suffix=".json", dir=COMMENTS_FILE.parent
    )
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(comments, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temporary_name, COMMENTS_FILE)
    except Exception:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise


class FootballHandler(SimpleHTTPRequestHandler):
    server_version = "FootballNews/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self.send_json({"status": "ok", "service": "football-news"})
            return

        if parsed.path == "/api/search":
            query = parse_qs(parsed.query).get("q", [""])[0].strip().lower()
            if not query:
                self.send_json({"query": "", "results": []})
                return
            results = [
                {"title": item["title"], "url": item["url"]}
                for item in SEARCH_ITEMS
                if query in f"{item['title']} {item['keywords']}".lower()
            ]
            self.send_json({"query": query, "results": results})
            return

        if parsed.path == "/api/comments":
            with COMMENTS_LOCK:
                comments = read_comments()
            self.send_json({"comments": comments})
            return

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/comments":
            self.send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 4096:
            self.send_json({"error": "请求内容无效"}, HTTPStatus.BAD_REQUEST)
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json({"error": "JSON 格式无效"}, HTTPStatus.BAD_REQUEST)
            return

        content = str(payload.get("content", "")).strip()
        if not content:
            self.send_json({"error": "评论不能为空"}, HTTPStatus.BAD_REQUEST)
            return
        if len(content) > 300:
            self.send_json({"error": "评论不能超过 300 个字符"}, HTTPStatus.BAD_REQUEST)
            return

        comment = {
            "id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
            "author": "本地访客",
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        with COMMENTS_LOCK:
            comments = read_comments()
            comments.append(comment)
            write_comments(comments)

        self.send_json({"comment": comment}, HTTPStatus.CREATED)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="启动绿茵快讯本地服务器")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), FootballHandler)
    print(f"绿茵快讯已启动：http://{args.host}:{args.port}")
    print("按 Ctrl+C 停止服务")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
