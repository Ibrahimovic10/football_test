/* ============================================================
   绿茵快讯 · 交互脚本（原生 JS，无任何依赖）
   功能：深色模式 / 导航高亮 / 焦点轮播 / Tab 切换 / 返回顶部 / 轻提示
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // 页面结构加载完成后统一初始化各项交互；不存在对应元素的页面会自动跳过。
  initTheme();
  initNav();
  initSlider();
  initTabs();
  initBackToTop();
  initToast();
  initDemoOnly();
  initComments();
});

/* ---------- 1. 深色模式 ---------- */
function initTheme() {
  // 主题状态写在 html[data-theme] 上，由 CSS 变量统一控制页面配色。
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  // 优先级：用户手动保存过 > 系统偏好
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = saved || (prefersDark ? 'dark' : 'light');

  toggle.addEventListener('click', () => {
    // 每次点击在亮色和深色之间切换，并记住用户选择。
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

/* ---------- 2. 导航高亮（依据 body 上的 data-page） ---------- */
function initNav() {
  // 各 HTML 页面通过 body[data-page] 声明当前页面，避免依赖当前 URL 的复杂解析。
  const page = document.body.dataset.page;
  if (!page) return;

  const map = { home: 'index.html', matches: 'matches.html', standings: 'standings.html', article: 'article.html' };
  const target = map[page];
  if (!target) return;

  document.querySelectorAll('.main-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    link.classList.toggle('active', href === target || (target === 'article.html' && href === target));
  });
}

/* ---------- 3. 首页焦点轮播 ---------- */
function initSlider() {
  // 轮播只负责切换已有的 .slide，不依赖图片或第三方轮播库。
  const slider = document.getElementById('hero-slider');
  if (!slider) return;

  const slides = slider.querySelectorAll('.slide');
  const dotsBox = document.getElementById('slider-dots');
  if (slides.length < 2) return;

  let current = 0;
  let timer = null;

  // 生成圆点指示器
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', `切换到第 ${i + 1} 张`);
    dot.addEventListener('click', () => goTo(i));
    dotsBox.appendChild(dot);
  });
  const dots = dotsBox.querySelectorAll('button');

  function goTo(index) {
    // 取模保证从第一张向前或从最后一张向后切换时仍能循环。
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function next() { goTo(current + 1); }
  function start() { stop(); timer = setInterval(next, 5000); }
  function stop() { if (timer) clearInterval(timer); }

  goTo(0);
  start();

  // 鼠标悬停时暂停，移出后继续
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', start);
}

/* ---------- 4. 联赛 Tab 切换（赛程 / 积分榜） ---------- */
function initTabs() {
  // data-tab 与 data-panel 使用同名值配对，实现赛程/积分榜的通用切换。
  document.querySelectorAll('[data-tabs]').forEach((tabBox) => {
    const buttons = tabBox.querySelectorAll('[data-tab]');

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.tab;

        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('[data-panel]').forEach((panel) => {
          panel.classList.toggle('active', panel.dataset.panel === name);
        });
      });
    });
  });
}

/* ---------- 5. 返回顶部 ---------- */
function initBackToTop() {
  // 页面滚动超过 400px 后显示按钮，点击时平滑回到页面顶部。
  const btn = document.getElementById('back-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ---------- 6. 轻提示 Toast ---------- */
let toastTimer = null;

function showToast(message) {
  // 复用同一个提示框；新消息会取消旧计时器，避免提示提前消失。
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function initToast() {
  // 搜索由前端拦截表单提交，再调用本地 JSON 接口并用 Toast 告知结果。
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = searchForm.querySelector('input');
      const query = input ? input.value.trim() : '';
      if (!query) {
        showToast('请输入搜索关键词');
        return;
      }

      try {
        const data = await requestJson(`/api/search?q=${encodeURIComponent(query)}`);
        if (!data.results.length) {
          showToast(`没有找到“${query}”相关内容`);
          return;
        }
        showToast(`找到 ${data.results.length} 条：${data.results[0].title}`);
      } catch (error) {
        showToast(`搜索失败：${error.message}`);
      }
    });
  }
}

async function requestJson(url, options = {}) {
  // 统一封装 fetch：解析 JSON，并把非 2xx 响应转换成可读错误。
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '服务器请求失败');
  return data;
}

/* ---------- 7. 演示站专属交互提示 ---------- */
function initDemoOnly() {
  // 这些按钮属于演示交互，暂时只反馈提示，不执行真实的视频或分享操作。
  // 视频卡片：无真实视频源
  document.querySelectorAll('[data-video]').forEach((card) => {
    card.addEventListener('click', () => showToast('🎬 演示站点：暂无视频源'));
  });

  // 分享按钮
  document.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', () => showToast('📤 演示站点：分享功能暂未开放'));
  });

}

function initComments() {
  // 评论区同时负责首次加载历史评论和提交新评论。
  const commentForm = document.getElementById('comment-form');
  const commentList = document.getElementById('comment-list');
  if (!commentForm || !commentList) return;

  loadComments(commentList);

  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = commentForm.querySelector('input');
      const content = input ? input.value.trim() : '';
      if (!content) {
        showToast('评论不能为空');
        return;
      }

      const button = commentForm.querySelector('button');
      if (button) button.disabled = true;
      try {
        const data = await requestJson('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        appendComment(commentList, data.comment);
        updateCommentCount(commentList);
        input.value = '';
        showToast('评论发表成功');
      } catch (error) {
        showToast(`评论失败：${error.message}`);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
}

async function loadComments(commentList) {
  // 服务端返回的评论逐条追加，追加函数会负责去重和安全渲染文本。
  try {
    const data = await requestJson('/api/comments');
    data.comments.forEach((comment) => appendComment(commentList, comment));
    updateCommentCount(commentList);
  } catch (error) {
    showToast(`评论加载失败：${error.message}`);
  }
}

function appendComment(commentList, comment) {
  // 使用 textContent 写入用户内容，避免把评论当作 HTML 执行。
  if (comment.id && commentList.querySelector(`[data-comment-id="${comment.id}"]`)) return;

  const item = document.createElement('div');
  item.className = 'comment-item';
  if (comment.id) item.dataset.commentId = comment.id;

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.style.background = '#0f8a4d';
  avatar.textContent = '访';

  const content = document.createElement('div');
  const head = document.createElement('div');
  head.className = 'comment-head';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = comment.author;
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = formatCommentTime(comment.created_at);
  head.append(name, time);

  const body = document.createElement('div');
  body.className = 'comment-body';
  body.textContent = comment.content;
  content.append(head, body);
  item.append(avatar, content);
  commentList.appendChild(item);
}

function updateCommentCount(commentList) {
  // 直接根据 DOM 中的评论项计数，确保加载和新增后的数字一致。
  const count = document.getElementById('comment-count');
  if (count) count.textContent = commentList.querySelectorAll('.comment-item').length;
}

function formatCommentTime(createdAt) {
  // 将服务端 ISO 时间转换为适合中文用户阅读的月-日 时:分格式。
  if (!createdAt) return '刚刚';
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '刚刚';
  return created.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
