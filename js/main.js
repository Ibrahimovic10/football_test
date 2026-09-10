/* ============================================================
   绿茵快讯 · 交互脚本（原生 JS，无任何依赖）
   功能：深色模式 / 导航高亮 / 焦点轮播 / Tab 切换 / 返回顶部 / 轻提示
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
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
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  // 优先级：用户手动保存过 > 系统偏好
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = saved || (prefersDark ? 'dark' : 'light');

  toggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

/* ---------- 2. 导航高亮（依据 body 上的 data-page） ---------- */
function initNav() {
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
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function initToast() {
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
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '服务器请求失败');
  return data;
}

/* ---------- 7. 演示站专属交互提示 ---------- */
function initDemoOnly() {
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
  try {
    const data = await requestJson('/api/comments');
    data.comments.forEach((comment) => appendComment(commentList, comment));
    updateCommentCount(commentList);
  } catch (error) {
    showToast(`评论加载失败：${error.message}`);
  }
}

function appendComment(commentList, comment) {
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
  const count = document.getElementById('comment-count');
  if (count) count.textContent = commentList.querySelectorAll('.comment-item').length;
}

function formatCommentTime(createdAt) {
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
