(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AdPageTemplates = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TEMPLATES = [
    { id: "promo", name: "產品促銷", desc: "突出優惠與商品賣點，適合主打機型與促銷檔期。" },
    { id: "service", name: "服務介紹", desc: "介紹維修、保養與買賣服務，建立專業信任。" },
    { id: "event", name: "活動宣傳", desc: "活動倒數與報名資訊，適合健診日、優惠月等檔期。" },
    { id: "ecommerce", name: "電商商品頁", desc: "單品展示、規格與購買資訊，適合詢價與銷售。" }
  ];

  var STYLES = [
    {
      id: "professional-blue",
      name: "專業藍調",
      bg: "#f4f7fb",
      bgAlt: "#ffffff",
      text: "#0f172a",
      muted: "#475569",
      primary: "#1d4ed8",
      accent: "#0369a1",
      card: "#ffffff",
      border: "rgba(15, 23, 42, 0.10)",
      header: "#0b1f4b",
      headerText: "#f8fafc",
      dark: false,
      font: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      display: '"Noto Sans TC", "PingFang TC", sans-serif'
    },
    {
      id: "minimal",
      name: "現代簡約",
      bg: "#f7f7f5",
      bgAlt: "#ffffff",
      text: "#18181b",
      muted: "#52525b",
      primary: "#18181b",
      accent: "#2563eb",
      card: "#ffffff",
      border: "rgba(24, 24, 27, 0.10)",
      header: "#ffffff",
      headerText: "#18181b",
      dark: false,
      font: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      display: '"Noto Sans TC", "PingFang TC", sans-serif'
    },
    {
      id: "tech-dark",
      name: "科技深色",
      bg: "#070b14",
      bgAlt: "#0f1624",
      text: "#e8eefc",
      muted: "#94a3b8",
      primary: "#38bdf8",
      accent: "#818cf8",
      card: "#121a2b",
      border: "rgba(148, 163, 184, 0.18)",
      header: "#070b14",
      headerText: "#e8eefc",
      dark: true,
      font: '"Noto Sans TC", "PingFang TC", sans-serif',
      display: '"Noto Sans TC", "PingFang TC", sans-serif'
    },
    {
      id: "vibrant",
      name: "活力繽紛",
      bg: "#fff7ed",
      bgAlt: "#ffffff",
      text: "#1c1917",
      muted: "#57534e",
      primary: "#e11d48",
      accent: "#f59e0b",
      card: "#ffffff",
      border: "rgba(28, 25, 23, 0.10)",
      header: "#9f1239",
      headerText: "#fff7ed",
      dark: false,
      font: '"Noto Sans TC", "PingFang TC", sans-serif',
      display: '"Noto Sans TC", "PingFang TC", sans-serif'
    },
    {
      id: "luxury",
      name: "奢華質感",
      bg: "#0c0a09",
      bgAlt: "#1c1917",
      text: "#faf7f2",
      muted: "#d6d3d1",
      primary: "#c9a227",
      accent: "#e8d5a3",
      card: "#171412",
      border: "rgba(201, 162, 39, 0.28)",
      header: "#0c0a09",
      headerText: "#faf7f2",
      dark: true,
      font: '"Noto Sans TC", "PingFang TC", sans-serif',
      display: '"Noto Serif TC", "Noto Sans TC", serif'
    }
  ];

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var renderOptions = {};

  function isSafeUrl(url) {
    if (!url) return false;
    var s = String(url).trim();
    if (!s) return false;
    if (s.charAt(0) === "#") return true;
    if (s.charAt(0) === "/" && s.charAt(1) !== "/") return true;
    if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s)) return true;
    if (/^blob:/i.test(s)) return true;
    try {
      var u = new URL(s, "https://example.invalid");
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function safeUrl(url, fallback) {
    var s = String(url || "").trim();
    return isSafeUrl(s) ? s : (fallback || "#");
  }

  function asList(val) {
    if (Array.isArray(val)) return val.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(val || "").split(/\r?\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function asImages(val) {
    var list = [];
    if (Array.isArray(val)) list = val;
    else if (val) list = String(val).split(/[\n,]+/);
    var out = [];
    for (var i = 0; i < list.length && out.length < 10; i++) {
      var item = list[i];
      if (item == null || item === "") continue;
      if (typeof item === "string") {
        var src = item.trim();
        if (!src) continue;
        out.push({ src: src, alt: "", hero: out.length === 0, kind: src.indexOf("/uploads/") === 0 || src.indexOf("data:") === 0 ? "upload" : "url" });
        continue;
      }
      var s = String(item.src || item.url || "").trim();
      if (!s) continue;
      out.push({
        id: item.id ? String(item.id) : "",
        src: s,
        alt: String(item.alt || "").trim(),
        hero: !!item.hero,
        kind: item.kind || (s.indexOf("/uploads/") === 0 || s.indexOf("data:") === 0 ? "upload" : "url")
      });
    }
    if (out.length && !out.some(function (im) { return im.hero; })) out[0].hero = true;
    if (out.filter(function (im) { return im.hero; }).length > 1) {
      var seen = false;
      out.forEach(function (im) {
        if (im.hero && seen) im.hero = false;
        else if (im.hero) seen = true;
      });
    }
    return out;
  }

  function heroImage(images) {
    var list = images || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].hero) return list[i];
    return list[0] || null;
  }

  function resolveSrc(src) {
    var s = String(src || "").trim();
    if (!s) return "";
    if (renderOptions.embedImages && renderOptions.embedImages[s]) return renderOptions.embedImages[s];
    if (renderOptions.rewriteImages && renderOptions.rewriteImages[s]) return renderOptions.rewriteImages[s];
    return s;
  }

  function absoluteUrl(src, baseUrl) {
    var s = String(src || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
    if (!baseUrl) return s;
    if (s.charAt(0) === "/") return String(baseUrl).replace(/\/$/, "") + s;
    return s;
  }

  function hexLuminance(hex) {
    var c = String(hex || "").replace("#", "").trim();
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 0;
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function contrastInk(hex) {
    return hexLuminance(hex) > 160 ? "#111111" : "#ffffff";
  }

  function isHexColor(v) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || "").trim());
  }

  function styleById(id) {
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].id === id) return STYLES[i];
    }
    return STYLES[0];
  }

  function templateById(id) {
    for (var i = 0; i < TEMPLATES.length; i++) {
      if (TEMPLATES[i].id === id) return TEMPLATES[i];
    }
    return TEMPLATES[1];
  }

  function normalize(input) {
    input = input || {};
    var template = templateById(input.template).id;
    var style = styleById(input.style).id;
    return {
      template: template,
      style: style,
      customPrimary: isHexColor(input.customPrimary) ? String(input.customPrimary).trim() : "",
      brandName: String(input.brandName || "").trim(),
      productName: String(input.productName || "").trim(),
      tagline: String(input.tagline || "").trim(),
      description: String(input.description || "").trim(),
      features: asList(input.features),
      price: String(input.price || "").trim(),
      originalPrice: String(input.originalPrice || "").trim(),
      offer: String(input.offer || "").trim(),
      ctaText: String(input.ctaText || "").trim() || "立即洽詢",
      ctaLink: String(input.ctaLink || "").trim() || "#contact",
      contact: String(input.contact || "").trim(),
      phone: String(input.phone || "").trim(),
      email: String(input.email || "").trim(),
      address: String(input.address || "").trim(),
      eventDate: String(input.eventDate || "").trim(),
      eventLocation: String(input.eventLocation || "").trim(),
      images: asImages(input.images)
    };
  }

  function themeVars(style, customPrimary) {
    var primary = customPrimary || style.primary;
    return {
      bg: style.bg,
      bgAlt: style.bgAlt,
      text: style.text,
      muted: style.muted,
      primary: primary,
      primaryInk: contrastInk(primary),
      accent: style.accent,
      card: style.card,
      border: style.border,
      header: style.header,
      headerText: style.headerText,
      dark: style.dark,
      font: style.font,
      display: style.display
    };
  }

  function placeholderSvg(label) {
    var safe = escapeHtml(label || "產品圖片");
    return (
      '<svg class="ph-svg" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
          '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="var(--primary)" stop-opacity="0.85"/>' +
            '<stop offset="1" stop-color="var(--accent)" stop-opacity="0.7"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="640" height="480" rx="24" fill="url(#pg)"/>' +
        '<rect x="190" y="168" width="260" height="150" rx="16" fill="rgba(255,255,255,0.18)"/>' +
        '<rect x="230" y="128" width="180" height="48" rx="8" fill="rgba(255,255,255,0.22)"/>' +
        '<circle cx="320" cy="244" r="28" fill="rgba(255,255,255,0.3)"/>' +
        '<text x="320" y="390" text-anchor="middle" fill="#fff" font-size="22" font-family="Noto Sans TC, sans-serif" font-weight="700">' + safe + "</text>" +
      "</svg>"
    );
  }

  function imageBlock(src, alt, className) {
    var cls = className || "media";
    var resolved = resolveSrc(src);
    if (resolved && isSafeUrl(resolved)) {
      return '<img class="' + cls + '" src="' + escapeHtml(resolved) + '" alt="' + escapeHtml(alt || "") + '">';
    }
    return '<div class="img-ph ' + cls + '" role="img" aria-label="' + escapeHtml(alt || "") + '">' +
      placeholderSvg(alt || "產品圖片") +
      "</div>";
  }

  function imgOf(im, altFallback, className) {
    if (!im) return imageBlock("", altFallback, className);
    return imageBlock(im.src, im.alt || altFallback, className);
  }

  function gallerySection(d) {
    var imgs = d.images || [];
    if (imgs.length < 2) return "";
    var slides = imgs.map(function (im, i) {
      return '<figure class="slide">' + imgOf(im, im.alt || d.productName || d.brandName || ("圖片 " + (i + 1)), "media") +
        (im.alt ? "<figcaption>" + escapeHtml(im.alt) + "</figcaption>" : "") +
        "</figure>";
    }).join("");
    return '<section class="gallery-section" id="gallery">' +
      '<div class="container">' +
        "<h2>圖片集</h2>" +
        '<div class="carousel" data-carousel>' +
          '<div class="carousel-viewport"><div class="carousel-track">' + slides + "</div></div>" +
          '<button type="button" class="carousel-btn carousel-prev" aria-label="上一張">‹</button>' +
          '<button type="button" class="carousel-btn carousel-next" aria-label="下一張">›</button>' +
          '<div class="carousel-dots"></div>' +
        "</div>" +
      "</div>" +
    "</section>";
  }

  function carouselScript() {
    var js = [
      "(function(){",
      "document.querySelectorAll('[data-carousel]').forEach(function(root){",
      "var track=root.querySelector('.carousel-track');",
      "var slides=[].slice.call(root.querySelectorAll('.slide'));",
      "var dotsBox=root.querySelector('.carousel-dots');",
      "if(!track||!slides.length)return;",
      "var i=0;",
      "function go(n){i=(n+slides.length)%slides.length;track.style.transform='translateX('+(-i*100)+'%)';",
      "if(dotsBox){var ds=dotsBox.querySelectorAll('button');for(var j=0;j<ds.length;j++)ds[j].classList.toggle('active',j===i);}",
      "}",
      "var prev=root.querySelector('.carousel-prev');",
      "var next=root.querySelector('.carousel-next');",
      "if(slides.length<2){if(prev)prev.hidden=true;if(next)next.hidden=true;if(dotsBox)dotsBox.hidden=true;return;}",
      "if(prev)prev.addEventListener('click',function(){go(i-1)});",
      "if(next)next.addEventListener('click',function(){go(i+1)});",
      "if(dotsBox){dotsBox.innerHTML=slides.map(function(_,j){return '<button type=\"button\" aria-label=\"'+ (j+1) +'\"></button>';}).join('');",
      "dotsBox.querySelectorAll('button').forEach(function(b,j){b.addEventListener('click',function(){go(j)})});}",
      "var startX=0;",
      "root.addEventListener('touchstart',function(e){startX=e.changedTouches[0].clientX;},{passive:true});",
      "root.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>40)go(i+(dx<0?1:-1));},{passive:true});",
      "go(0);",
      "});",
      "})();"
    ].join("");
    return "<script>" + js + "</scr" + "ipt>";
  }

  function featuresList(features, className) {
    if (!features.length) return "";
    return '<ul class="' + (className || "feature-list") + '">' +
      features.map(function (f) {
        return "<li><span class=\"tick\" aria-hidden=\"true\"></span><span>" + escapeHtml(f) + "</span></li>";
      }).join("") +
      "</ul>";
  }

  function contactItems(d) {
    var items = [];
    if (d.phone) items.push({ k: "電話", v: d.phone, href: d.phone.indexOf("請填入") === 0 ? "" : "tel:" + d.phone.replace(/\s+/g, "") });
    if (d.email) items.push({ k: "電子郵件", v: d.email, href: d.email.indexOf("請填入") === 0 ? "" : "mailto:" + d.email });
    if (d.address) items.push({ k: "地址", v: d.address, href: "" });
    if (d.contact) items.push({ k: "聯絡說明", v: d.contact, href: "" });
    if (!items.length) return "";
    return '<ul class="contact-list">' + items.map(function (it) {
      var value = it.href
        ? '<a href="' + escapeHtml(it.href) + '">' + escapeHtml(it.v) + "</a>"
        : escapeHtml(it.v);
      return "<li><span>" + escapeHtml(it.k) + "</span><strong>" + value + "</strong></li>";
    }).join("") + "</ul>";
  }

  function formatEventDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch (e) {
      return String(iso);
    }
  }

  function navHtml(d, theme, ctaHref) {
    return (
      '<header class="site-header">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="#top">' + escapeHtml(d.brandName || "品牌") + "</a>" +
          '<a class="btn btn-sm" href="' + escapeHtml(safeUrl(ctaHref || d.ctaLink, "#contact")) + '">' +
            escapeHtml(d.ctaText) +
          "</a>" +
        "</div>" +
      "</header>"
    );
  }

  function footerHtml(d) {
    var year = new Date().getFullYear();
    return (
      '<footer class="site-footer" id="contact">' +
        '<div class="container footer-grid">' +
          "<div>" +
            '<p class="brand-foot">' + escapeHtml(d.brandName || "") + "</p>" +
            (d.tagline ? "<p class=\"muted\">" + escapeHtml(d.tagline) + "</p>" : "") +
            (d.offer ? "<p class=\"offer-note\">" + escapeHtml(d.offer) + "</p>" : "") +
          "</div>" +
          "<div>" +
            "<h2>聯絡我們</h2>" +
            contactItems(d) +
          "</div>" +
        "</div>" +
        '<div class="container copyright">© ' + year + " " + escapeHtml(d.brandName || "") + "</div>" +
      "</footer>"
    );
  }

  function priceBlock(d) {
    if (!d.price && !d.offer) return "";
    return (
      '<div class="price-block">' +
        (d.originalPrice ? '<span class="price-old">' + escapeHtml(d.originalPrice) + "</span>" : "") +
        (d.price ? '<span class="price-now">' + escapeHtml(d.price) + "</span>" : "") +
        (d.offer ? '<span class="price-offer">' + escapeHtml(d.offer) + "</span>" : "") +
      "</div>"
    );
  }

  function sharedCss(theme) {
    return [
      ":root{",
      "--bg:" + theme.bg + ";",
      "--bg-alt:" + theme.bgAlt + ";",
      "--text:" + theme.text + ";",
      "--muted:" + theme.muted + ";",
      "--primary:" + theme.primary + ";",
      "--primary-ink:" + theme.primaryInk + ";",
      "--accent:" + theme.accent + ";",
      "--card:" + theme.card + ";",
      "--border:" + theme.border + ";",
      "--header:" + theme.header + ";",
      "--header-text:" + theme.headerText + ";",
      "--font:" + theme.font + ";",
      "--display:" + theme.display + ";",
      "--shadow: 0 18px 50px rgba(15,23,42,.08);",
      "--radius: 18px;",
      "}",
      "*,*::before,*::after{box-sizing:border-box}",
      "html{scroll-behavior:smooth}",
      "body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.7;}",
      "img{max-width:100%;display:block}",
      "a{color:var(--primary);text-decoration:none}",
      "h1,h2,h3,.brand,.brand-foot{font-family:var(--display);letter-spacing:.02em}",
      ".container{width:min(1120px,calc(100% - 40px));margin:0 auto}",
      ".site-header{position:sticky;top:0;z-index:20;background:var(--header);color:var(--header-text);border-bottom:1px solid var(--border);backdrop-filter:blur(12px)}",
      ".header-inner{display:flex;align-items:center;justify-content:space-between;min-height:68px;gap:16px}",
      ".brand{color:var(--header-text);font-weight:800;font-size:1.15rem;letter-spacing:.08em}",
      ".btn{display:inline-flex;align-items:center;justify-content:center;background:var(--primary);color:var(--primary-ink);border:0;border-radius:999px;padding:14px 22px;font-weight:700;cursor:pointer;font-size:1rem;box-shadow:0 8px 24px color-mix(in srgb,var(--primary) 35%, transparent)}",
      ".btn:hover{filter:brightness(1.08)}",
      ".btn-sm{padding:8px 16px;font-size:.92rem}",
      ".btn-ghost{background:transparent;color:inherit;border:1px solid color-mix(in srgb,currentColor 35%, transparent);box-shadow:none}",
      ".hero{padding:72px 0 48px}",
      ".hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}",
      ".eyebrow{display:inline-block;font-size:.82rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--primary);margin-bottom:12px}",
      "h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.2;margin:0 0 16px;font-weight:800}",
      ".tagline{font-size:1.2rem;color:var(--muted);margin:0 0 20px}",
      ".lead{font-size:1.05rem;color:var(--muted);margin:0 0 24px}",
      ".hero-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:8px}",
      ".media,.img-ph{width:100%;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);background:var(--card);min-height:280px;object-fit:cover}",
      ".img-ph{display:flex;align-items:center;justify-content:center;min-height:320px}",
      ".ph-svg{width:100%;height:auto;display:block}",
      ".offer-banner{background:var(--primary);color:var(--primary-ink);text-align:center;padding:10px 16px;font-weight:700}",
      "section{padding:64px 0}",
      "h2{font-size:clamp(1.5rem,3vw,2.1rem);margin:0 0 24px}",
      ".feature-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}",
      ".feature-list li{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px}",
      ".tick{width:22px;height:22px;flex:0 0 22px;border-radius:50%;background:var(--primary);position:relative;top:2px}",
      ".tick::after{content:'';position:absolute;left:7px;top:4px;width:6px;height:11px;border:2px solid var(--primary-ink);border-top:0;border-left:0;transform:rotate(45deg)}",
      ".cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}",
      ".card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow)}",
      ".card h3{margin:0 0 8px;font-size:1.05rem}",
      ".card .num{color:var(--primary);font-weight:800;font-size:.9rem;letter-spacing:.12em;margin-bottom:8px}",
      ".price-block{display:flex;flex-direction:column;gap:6px;margin:18px 0}",
      ".price-old{color:var(--muted);text-decoration:line-through;font-size:.95rem}",
      ".price-now{font-size:2rem;font-weight:800;color:var(--primary);letter-spacing:.02em}",
      ".price-offer,.offer-note{color:var(--accent);font-weight:700}",
      ".cta-band{background:var(--bg-alt);border-block:1px solid var(--border);text-align:center}",
      ".site-footer{background:var(--header);color:var(--header-text);padding:56px 0 24px}",
      ".footer-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:32px}",
      ".brand-foot{font-size:1.4rem;font-weight:800;margin:0 0 8px}",
      ".site-footer h2{font-size:1.15rem;margin-bottom:12px;color:var(--header-text)}",
      ".site-footer .muted,.site-footer .offer-note{color:color-mix(in srgb,var(--header-text) 80%, transparent)}",
      ".contact-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}",
      ".contact-list li{display:grid;gap:2px}",
      ".contact-list span{font-size:.8rem;opacity:.75}",
      ".contact-list a,.contact-list strong{color:var(--header-text)}",
      ".copyright{opacity:.7;font-size:.85rem;margin-top:32px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--header-text) 18%, transparent)}",
      ".countdown{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0}",
      ".cd-unit{min-width:82px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 12px;text-align:center}",
      ".cd-unit strong{display:block;font-size:2rem;font-variant-numeric:tabular-nums;line-height:1}",
      ".cd-unit span{font-size:.8rem;color:var(--muted)}",
      ".ended{font-weight:700}",
      ".meta-chips{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 8px}",
      ".chip{border:1px solid var(--border);border-radius:999px;padding:6px 12px;background:var(--card);font-size:.9rem}",
      ".gallery{display:grid;gap:12px}",
      ".thumbs{display:flex;gap:8px;flex-wrap:wrap}",
      ".thumbs button{border:2px solid transparent;padding:0;background:none;border-radius:12px;overflow:hidden;cursor:pointer;width:76px;height:76px}",
      ".thumbs button.active,.thumbs button:focus{border-color:var(--primary)}",
      ".thumbs img,.thumbs .img-ph{min-height:76px;height:76px;width:76px;object-fit:cover;border-radius:10px;box-shadow:none}",
      ".ecom-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}",
      ".gallery-section{padding-top:24px}",
      ".carousel{position:relative}",
      ".carousel-viewport{overflow:hidden;border-radius:var(--radius);box-shadow:var(--shadow);background:var(--card)}",
      ".carousel-track{display:flex;transition:transform .35s ease}",
      ".carousel-track .slide{min-width:100%;margin:0;padding:0}",
      ".carousel-track .slide img,.carousel-track .slide .img-ph{min-height:280px;max-height:560px;object-fit:cover;width:100%;border-radius:0;box-shadow:none}",
      ".carousel-track figcaption{padding:10px 16px;color:var(--muted);font-size:.9rem}",
      ".carousel-btn{position:absolute;top:46%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:50%;background:color-mix(in srgb,var(--card) 85%, transparent);color:var(--text);font-size:1.4rem;cursor:pointer;box-shadow:var(--shadow)}",
      ".carousel-prev{left:10px}",
      ".carousel-next{right:10px}",
      ".carousel-dots{display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap}",
      ".carousel-dots button{width:9px;height:9px;padding:0;border:0;border-radius:50%;background:var(--border);cursor:pointer}",
      ".carousel-dots button.active{background:var(--primary);transform:scale(1.2)}",
      "@media (max-width: 860px){",
      ".hero-grid,.footer-grid,.ecom-grid{grid-template-columns:1fr}",
      ".hero{padding:40px 0 24px}",
      "section{padding:44px 0}",
      "}",
    ].join("");
  }

  function renderPromo(d) {
    var hero = heroImage(d.images);
    var img = imgOf(hero, d.productName || d.brandName, "media");
    return (
      (d.offer ? '<div class="offer-banner">' + escapeHtml(d.offer) + "</div>" : "") +
      navHtml(d) +
      '<main id="top">' +
        '<section class="hero">' +
          '<div class="container hero-grid">' +
            "<div>" +
              '<p class="eyebrow">' + escapeHtml(d.brandName) + "</p>" +
              "<h1>" + escapeHtml(d.productName || d.brandName) + "</h1>" +
              (d.tagline ? '<p class="tagline">' + escapeHtml(d.tagline) + "</p>" : "") +
              (d.description ? '<p class="lead">' + escapeHtml(d.description) + "</p>" : "") +
              priceBlock(d) +
              '<div class="hero-actions"><a class="btn" href="' + escapeHtml(safeUrl(d.ctaLink, "#contact")) + '">' + escapeHtml(d.ctaText) + "</a></div>" +
            "</div>" +
            img +
          "</div>" +
        "</section>" +
        (d.features.length
          ? '<section><div class="container"><h2>為什麼選擇我們</h2>' + featuresList(d.features) + "</div></section>"
          : "") +
        gallerySection(d) +
        '<section class="cta-band"><div class="container"><h2>想進一步了解或預約？</h2><p class="lead">歡迎直接洽詢，我們會儘快與您聯繫。</p><a class="btn" href="#contact">' + escapeHtml(d.ctaText) + "</a></div></section>" +
      "</main>" +
      footerHtml(d)
    );
  }

  function renderService(d) {
    var steps = [
      { n: "01", t: "預約評估", p: "告知設備型號與狀況，安排檢測時間。" },
      { n: "02", t: "檢測報價", p: "檢查故障或保養需求，清楚說明處理方式與費用。" },
      { n: "03", t: "維修保養", p: "進行零件更換、校正或保養，並測試運作。" },
      { n: "04", t: "交機說明", p: "說明使用與日常保養注意事項，減少再次故障。" }
    ];
    var featureCards = d.features.map(function (f, i) {
      return '<article class="card"><div class="num">服務 ' + String(i + 1).padStart(2, "0") + "</div><h3>" + escapeHtml(f) + "</h3></article>";
    }).join("");
    return (
      navHtml(d) +
      '<main id="top">' +
        '<section class="hero">' +
          '<div class="container hero-grid">' +
            "<div>" +
              '<p class="eyebrow">維修　／　買賣　／　保養</p>' +
              "<h1>" + escapeHtml(d.productName || d.brandName) + "</h1>" +
              (d.tagline ? '<p class="tagline">' + escapeHtml(d.tagline) + "</p>" : "") +
              (d.description ? '<p class="lead">' + escapeHtml(d.description) + "</p>" : "") +
              (d.offer ? "<p class=\"price-offer\">" + escapeHtml(d.offer) + "</p>" : "") +
              '<div class="hero-actions"><a class="btn" href="' + escapeHtml(safeUrl(d.ctaLink, "#contact")) + '">' + escapeHtml(d.ctaText) + "</a></div>" +
            "</div>" +
            imgOf(heroImage(d.images), d.brandName, "media") +
          "</div>" +
        "</section>" +
        (d.features.length
          ? '<section><div class="container"><h2>服務項目</h2><div class="cards">' + featureCards + "</div></div></section>"
          : "") +
        '<section><div class="container"><h2>服務流程</h2><div class="cards">' +
          steps.map(function (s) {
            return '<article class="card"><div class="num">' + s.n + "</div><h3>" + s.t + "</h3><p class=\"lead\" style=\"margin:0\">" + s.p + "</p></article>";
          }).join("") +
        "</div></div></section>" +
        gallerySection(d) +
        '<section class="cta-band"><div class="container"><h2>需要協助或想進一步了解？</h2><p class="lead">歡迎先聯絡我們，說明您的需求。</p><a class="btn" href="#contact">' + escapeHtml(d.ctaText) + "</a></div></section>" +
      "</main>" +
      footerHtml(d)
    );
  }

  function renderEvent(d) {
    var when = formatEventDate(d.eventDate);
    var chips = "";
    if (when) chips += '<span class="chip">時間：' + escapeHtml(when) + "</span>";
    if (d.eventLocation) chips += '<span class="chip">地點：' + escapeHtml(d.eventLocation) + "</span>";
    var countdown = d.eventDate
      ? '<div class="countdown" id="countdown" data-target="' + escapeHtml(d.eventDate) + '"></div>'
      : "";
    return (
      (d.offer ? '<div class="offer-banner">' + escapeHtml(d.offer) + "</div>" : "") +
      navHtml(d) +
      '<main id="top">' +
        '<section class="hero">' +
          '<div class="container">' +
            '<p class="eyebrow">' + escapeHtml(d.brandName) + "　活動宣傳</p>" +
            "<h1>" + escapeHtml(d.productName || "活動即將開始") + "</h1>" +
            (d.tagline ? '<p class="tagline">' + escapeHtml(d.tagline) + "</p>" : "") +
            (chips ? '<div class="meta-chips">' + chips + "</div>" : "") +
            countdown +
            (d.description ? '<p class="lead" style="max-width:720px">' + escapeHtml(d.description) + "</p>" : "") +
            '<div class="hero-actions"><a class="btn" href="' + escapeHtml(safeUrl(d.ctaLink, "#contact")) + '">' + escapeHtml(d.ctaText) + "</a></div>" +
          "</div>" +
          (heroImage(d.images) ? '<div style="margin-top:28px">' + imgOf(heroImage(d.images), d.productName || "活動圖片", "media") + "</div>" : "") +
        "</section>" +
        (d.features.length
          ? '<section><div class="container"><h2>活動內容</h2>' + featuresList(d.features) + "</div></section>"
          : "") +
        gallerySection(d) +
        '<section class="cta-band"><div class="container"><h2>名額有限，歡迎提早預約</h2><a class="btn" href="#contact">' + escapeHtml(d.ctaText) + "</a></div></section>" +
      "</main>" +
      footerHtml(d) +
      (d.eventDate ? "<script>(function(){var el=document.getElementById('countdown');if(!el)return;var target=Date.parse(el.getAttribute('data-target'));function pad(n){return String(n).padStart(2,'0');}function tick(){var diff=target-Date.now();if(isNaN(target)){el.innerHTML='<p>請設定活動日期</p>';return;}if(diff<=0){el.innerHTML='<p class=\"ended\">活動已開始或已結束</p>';return;}var s=Math.floor(diff/1000);var d=Math.floor(s/86400);s%=86400;var h=Math.floor(s/3600);s%=3600;var m=Math.floor(s/60);s%=60;el.innerHTML=[d,h,m,s].map(function(v,i){return '<div class=\"cd-unit\"><strong>'+pad(v)+'</strong><span>'+['天','時','分','秒'][i]+'</span></div>';}).join('');}tick();setInterval(tick,1000);})();<\/script>" : "")
    );
  }

  function renderEcommerce(d) {
    var imgs = d.images.length ? d.images : [];
    var hero = heroImage(imgs) || { src: "", alt: d.productName || d.brandName };
    var main = imgOf(hero, d.productName || d.brandName, "media js-main-img");
    var thumbs = imgs.length > 1
      ? '<div class="thumbs">' + imgs.map(function (im, i) {
          var resolved = resolveSrc(im.src);
          var isHero = hero && im.src === hero.src;
          return '<button type="button" class="' + (isHero ? "active" : "") + '" data-src="' + escapeHtml(isSafeUrl(resolved) ? resolved : "") + '" aria-label="圖片 ' + (i + 1) + '">' +
            imgOf(im, "縮圖 " + (i + 1), "media") +
            "</button>";
        }).join("") + "</div>"
      : "";
    var specs = d.features.length
      ? "<h2>商品特色與規格</h2>" + featuresList(d.features)
      : "";
    return (
      navHtml(d) +
      '<main id="top">' +
        '<section class="hero">' +
          '<div class="container ecom-grid">' +
            '<div class="gallery">' + main + thumbs + "</div>" +
            "<div>" +
              '<p class="eyebrow">' + escapeHtml(d.brandName) + "　商品</p>" +
              "<h1>" + escapeHtml(d.productName || d.brandName) + "</h1>" +
              (d.tagline ? '<p class="tagline">' + escapeHtml(d.tagline) + "</p>" : "") +
              priceBlock(d) +
              (d.description ? '<p class="lead">' + escapeHtml(d.description) + "</p>" : "") +
              '<div class="hero-actions">' +
                '<a class="btn" href="' + escapeHtml(safeUrl(d.ctaLink, "#contact")) + '">' + escapeHtml(d.ctaText) + "</a>" +
                '<a class="btn btn-ghost" href="#contact">聯絡我們</a>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</section>" +
        (specs ? '<section><div class="container">' + specs + "</div></section>" : "") +
        gallerySection(d) +
        '<section class="cta-band"><div class="container"><h2>需要配件或其他相關產品？</h2><p class="lead">歡迎一併詢價或留言，我們會儘快回覆。</p><a class="btn" href="#contact">' + escapeHtml("聯絡" + (d.brandName || "我們")) + "</a></div></section>" +
      "</main>" +
      footerHtml(d) +
      (imgs.length > 1
        ? "<script>(function(){var main=document.querySelector('.js-main-img');var thumbs=document.querySelectorAll('.thumbs button');thumbs.forEach(function(btn){btn.addEventListener('click',function(){thumbs.forEach(function(b){b.classList.remove('active')});btn.classList.add('active');var src=btn.getAttribute('data-src');if(main && main.tagName==='IMG' && src){main.src=src;}});});})();<\/script>"
        : "")
    );
  }

  // I'll override below by leaving raw iso for invalid dates - already planned in use.

  function bodyFor(d) {
    if (d.template === "promo") return renderPromo(d);
    if (d.template === "event") return renderEvent(d);
    if (d.template === "ecommerce") return renderEcommerce(d);
    return renderService(d);
  }

  function render(input, options) {
    renderOptions = options || {};
    var d = normalize(input);
    var style = styleById(d.style);
    var theme = themeVars(style, d.customPrimary);
    var titleBits = [d.productName, d.brandName].filter(Boolean);
    var title = titleBits.join("｜") || "落地頁";
    var desc = d.tagline || d.description || ((d.brandName || "") + "官方頁面");
    var hero = heroImage(d.images);
    var ogImage = "";
    if (hero && hero.src) {
      var resolvedHero = resolveSrc(hero.src);
      ogImage = absoluteUrl(resolvedHero, renderOptions.baseUrl || "");
      if (/^(data:|blob:)/i.test(ogImage)) ogImage = "";
    }
    var pageUrl = renderOptions.pageUrl || "";
    var og = "<title>" + escapeHtml(title) + "</title>\n" +
      "<meta name=\"description\" content=\"" + escapeHtml(desc).slice(0, 160) + "\">\n" +
      "<meta property=\"og:title\" content=\"" + escapeHtml(title) + "\">\n" +
      "<meta property=\"og:description\" content=\"" + escapeHtml(desc).slice(0, 160) + "\">\n" +
      "<meta property=\"og:type\" content=\"website\">\n" +
      (pageUrl ? "<meta property=\"og:url\" content=\"" + escapeHtml(pageUrl) + "\">\n<link rel=\"canonical\" href=\"" + escapeHtml(pageUrl) + "\">\n" : "") +
      (ogImage ? "<meta property=\"og:image\" content=\"" + escapeHtml(ogImage) + "\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n" : "<meta name=\"twitter:card\" content=\"summary\">\n");
    var html = "<!DOCTYPE html>\n<html lang=\"zh-Hant\">\n<head>\n" +
      "<meta charset=\"UTF-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      og +
      "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n" +
      "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n" +
      "<link href=\"https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;800&family=Noto+Serif+TC:wght@600;700&display=swap\" rel=\"stylesheet\">\n" +
      "<style>" + sharedCss(theme) + "</style>\n" +
      "</head>\n<body>\n" +
      bodyFor(d) +
      (d.images && d.images.length > 1 ? "\n" + carouselScript() : "") +
      "\n</body>\n</html>";
    renderOptions = {};
    return html;
  }

  return {
    TEMPLATES: TEMPLATES,
    STYLES: STYLES,
    render: render,
    normalize: normalize,
    asImages: asImages,
    heroImage: heroImage,
    escapeHtml: escapeHtml,
    styleById: styleById,
    templateById: templateById
  };
});
