const slides = [
  "slides/slide-01/index.html",
  "slides/slide-02/index.html",
  "slides/slide-03/index.html",
  "slides/slide-04/index.html",
  "slides/slide-05/index.html",
  "slides/slide-06/index.html",
  "slides/slide-07/index.html",
  "slides/slide-08/index.html",
  "slides/slide-09/index.html",
  "slides/slide-10/index.html",
  "slides/slide-11/index.html",
  "slides/slide-12/index.html",
  "slides/slide-13/index.html",
  "slides/slide-14/index.html",
  "slides/slide-15/index.html",
  "slides/slide-16/index.html",
  "slides/slide-17/index.html",
];

const languageStorageKey = "enisDeckLanguage";
const languageMessageSet = "enis-deck-language";
const languageMessageApply = "enis-deck-language-apply";
const frame = document.querySelector("#slide-frame");
const thumbs = [...document.querySelectorAll(".thumb")];
const currentSlide = document.querySelector("#current-slide");
const totalSlides = document.querySelector("#total-slides");
const prev = document.querySelector("#prev-slide");
const next = document.querySelector("#next-slide");
const closePresentation = document.querySelector("#close-presentation");
const closePresentationLabel = closePresentation.querySelector(".close-presentation-label");
const presentationLoader = document.querySelector("#presentation-loader");
const fullscreenStartButton = document.querySelector("#fullscreen-start-button");
const presentationLoadingBar = document.querySelector("#presentation-loading-bar");
const presentationLoadingPercent = document.querySelector("#presentation-loading-percent");
const presentationLoadingTrack = document.querySelector("#presentation-loading-track");
const presentationLoadingStatus = document.querySelector("#presentation-loading-status");
const scrollSlideIndexes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
let active = 0;
let deckLanguage = readDeckLanguage();
let presentationStarting = false;
let presentationAssetsReady = false;
let presentationPreloadPromise = null;

const presentationPreloadAssets = Array.isArray(window.PRESENTATION_PRELOAD_ASSETS)
  ? window.PRESENTATION_PRELOAD_ASSETS.map((asset) => ({
      url: asset.url,
      size: Math.max(1, Number(asset.size) || 1),
    }))
  : slides.map((url) => ({ url, size: 1 }));

window.__presentationPreloadedAssets = window.__presentationPreloadedAssets || [];
window.__presentationPreloadState = {
  ready: false,
  totalAssets: presentationPreloadAssets.length,
  completedAssets: 0,
  loadedBytes: 0,
  totalBytes: presentationPreloadAssets.reduce((sum, asset) => sum + asset.size, 0),
  failedAssets: [],
};

async function enterDeckFullscreen() {
  if (document.fullscreenElement) return true;

  if (typeof document.documentElement.requestFullscreen !== "function") return false;

  try {
    await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    return Boolean(document.fullscreenElement);
  } catch (error) {
    // Browsers normally require a click or key press before allowing fullscreen.
  }

  return false;
}

function updatePresentationLoading(progress) {
  const value = Math.max(0, Math.min(100, Math.floor(progress)));
  presentationLoadingBar.style.transform = `scaleX(${value / 100})`;
  presentationLoadingPercent.textContent = `${value}%`;
  presentationLoadingTrack.setAttribute("aria-valuenow", String(value));
}

function formatPreloadBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function preloadAssetWithElement(asset) {
  return new Promise((resolve, reject) => {
    const absoluteUrl = new URL(asset.url, document.baseURI).href;
    const imageUrl = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(absoluteUrl);
    const timeout = window.setTimeout(() => finish(false), 120000);
    let element;
    let settled = false;

    function finish(succeeded) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      element.onload = null;
      element.onerror = null;

      if (element instanceof HTMLIFrameElement) {
        element.remove();
      }

      if (succeeded) {
        resolve();
      } else {
        reject(new Error(`자료를 불러오지 못했습니다: ${asset.url}`));
      }
    }

    if (imageUrl) {
      element = new Image();
      element.decoding = "async";
      element.onload = () => finish(true);
      element.onerror = () => finish(false);
      window.__presentationPreloadedAssets.push(element);
      element.src = absoluteUrl;
      return;
    }

    element = document.createElement("iframe");
    element.hidden = true;
    element.tabIndex = -1;
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("sandbox", "");
    element.onload = () => finish(true);
    element.onerror = () => finish(false);
    document.body.appendChild(element);
    element.src = absoluteUrl;
  });
}

async function preloadAsset(asset, onBytesLoaded) {
  let creditedBytes = 0;

  function credit(bytes) {
    const remaining = asset.size - creditedBytes;
    const increment = Math.max(0, Math.min(remaining, Number(bytes) || 0));
    creditedBytes += increment;
    onBytesLoaded(increment);
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    let response;

    try {
      response = await fetch(asset.url, {
        cache: "force-cache",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 0) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          credit(value.byteLength);
        }
      } else {
        const buffer = await response.arrayBuffer();
        credit(buffer.byteLength);
      }
    } finally {
      window.clearTimeout(timeout);
    }

    credit(asset.size - creditedBytes);
  } catch (fetchError) {
    // Directly opening index.html uses file://, where fetch is commonly blocked.
    // Loading the same URL through an image or sandboxed frame still reads the full file.
    if (window.location.protocol !== "file:") {
      throw new Error(`자료를 불러오지 못했습니다: ${asset.url}`);
    }
    await preloadAssetWithElement(asset);
    credit(asset.size - creditedBytes);
  }
}

function preloadPresentationAssets() {
  if (presentationAssetsReady) return Promise.resolve(window.__presentationPreloadState);
  if (presentationPreloadPromise) return presentationPreloadPromise;

  presentationPreloadPromise = (async () => {
    const totalAssets = presentationPreloadAssets.length;
    const totalBytes = presentationPreloadAssets.reduce((sum, asset) => sum + asset.size, 0);
    const state = {
      ready: false,
      totalAssets,
      completedAssets: 0,
      loadedBytes: 0,
      totalBytes,
      failedAssets: [],
    };
    window.__presentationPreloadState = state;

    let nextAssetIndex = 0;

    function renderProgress() {
      const byteProgress = totalBytes ? (state.loadedBytes / totalBytes) * 100 : 0;
      const allLoaded =
        state.completedAssets === totalAssets &&
        state.failedAssets.length === 0 &&
        state.loadedBytes >= totalBytes;
      const visibleProgress = allLoaded ? 100 : Math.min(99, byteProgress);
      updatePresentationLoading(visibleProgress);
      presentationLoadingStatus.textContent =
        `자료 불러오는 중 ${state.completedAssets}/${totalAssets} · ` +
        `${formatPreloadBytes(state.loadedBytes)} / ${formatPreloadBytes(totalBytes)}`;
    }

    async function worker() {
      while (nextAssetIndex < totalAssets) {
        const assetIndex = nextAssetIndex;
        nextAssetIndex += 1;
        const asset = presentationPreloadAssets[assetIndex];

        try {
          await preloadAsset(asset, (increment) => {
            state.loadedBytes = Math.min(totalBytes, state.loadedBytes + increment);
            renderProgress();
          });
        } catch (error) {
          state.failedAssets.push(asset.url);
        } finally {
          state.completedAssets += 1;
          renderProgress();
        }
      }
    }

    renderProgress();
    const workerCount = Math.min(6, Math.max(1, totalAssets));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (state.failedAssets.length) {
      throw new Error(`${state.failedAssets.length}개 자료를 불러오지 못했습니다.`);
    }

    state.loadedBytes = totalBytes;
    state.ready = true;
    presentationAssetsReady = true;
    updatePresentationLoading(100);
    return state;
  })().catch((error) => {
    presentationPreloadPromise = null;
    throw error;
  });

  return presentationPreloadPromise;
}

fullscreenStartButton.addEventListener("click", async () => {
  if (presentationStarting) return;
  presentationStarting = true;
  fullscreenStartButton.disabled = true;
  presentationLoader.classList.add("is-loading");
  presentationLoadingStatus.textContent = "전체 자료 다운로드를 시작합니다.";
  if (!presentationAssetsReady) updatePresentationLoading(0);

  // Keep the fullscreen request inside the click event so browser permission is preserved.
  const fullscreenRequest = enterDeckFullscreen();
  let enteredFullscreen = false;

  try {
    [enteredFullscreen] = await Promise.all([fullscreenRequest, preloadPresentationAssets()]);
  } catch (error) {
    presentationLoader.classList.remove("is-loading");
    fullscreenStartButton.disabled = false;
    fullscreenStartButton.querySelector("strong").textContent = "자료 다시 불러오기";
    presentationLoadingStatus.textContent = `${error.message} 버튼을 눌러 다시 시도해 주세요.`;
    presentationStarting = false;
    return;
  }

  if (!enteredFullscreen) {
    presentationLoader.classList.remove("is-loading");
    fullscreenStartButton.disabled = false;
    fullscreenStartButton.querySelector("strong").textContent = "전체화면 다시 시도";
    presentationLoadingStatus.textContent = "전체화면 전환이 차단되었습니다. 버튼을 다시 눌러주세요.";
    presentationStarting = false;
    return;
  }

  presentationLoadingStatus.textContent = "전체 자료 다운로드와 전체화면 준비가 완료되었습니다.";
  window.setTimeout(() => {
    presentationLoader.classList.add("is-complete");
    presentationLoader.setAttribute("aria-hidden", "true");
  }, 180);
});

document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("fullscreen-active", Boolean(document.fullscreenElement));
});

totalSlides.textContent = String(slides.length).padStart(2, "0");

function normalizeDeckLanguage(lang) {
  return lang === "en" ? "en" : "ko";
}

function readDeckLanguage() {
  try {
    return normalizeDeckLanguage(localStorage.getItem(languageStorageKey));
  } catch (error) {
    return "ko";
  }
}

function writeDeckLanguage(lang) {
  deckLanguage = normalizeDeckLanguage(lang);
  try {
    localStorage.setItem(languageStorageKey, deckLanguage);
  } catch (error) {
    // file:// contexts can block storage; keep the in-memory value for this deck session.
  }
}

function postLanguageToFrame() {
  try {
    frame.contentWindow.postMessage({ type: languageMessageApply, lang: deckLanguage }, "*");
  } catch (error) {
    // The slide will still read its own stored language when it loads.
  }
}

function applySlideMode() {
  const isScrollSlide = scrollSlideIndexes.has(active);
  document.body.classList.toggle("scroll-slide-active", isScrollSlide);
  frame.setAttribute("scrolling", isScrollSlide ? "yes" : "no");
}

function setSlide(index) {
  active = (index + slides.length) % slides.length;
  frame.classList.remove("is-ready");
  applySlideMode();
  frame.src = slides[active];
  currentSlide.textContent = String(active + 1).padStart(2, "0");
  thumbs.forEach((thumb, thumbIndex) => {
    thumb.classList.toggle("active", thumbIndex === active);
  });
}

frame.addEventListener("load", () => {
  frame.classList.add("is-ready");
  applySlideMode();
  postLanguageToFrame();
  try {
    frame.contentWindow.scrollTo(0, 0);
  } catch (error) {
    // Local file mode can restrict cross-frame access in some browsers.
  }
});

window.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === languageMessageSet && data.lang) {
    writeDeckLanguage(data.lang);
    postLanguageToFrame();
  }
});

thumbs.forEach((thumb) => {
  thumb.addEventListener("click", () => setSlide(Number(thumb.dataset.slide)));
});

prev.addEventListener("click", () => setSlide(active - 1));
next.addEventListener("click", () => setSlide(active + 1));

closePresentation.addEventListener("click", () => {
  closePresentation.disabled = true;
  closePresentation.classList.add("is-closing");
  closePresentationLabel.textContent = "PPT 종료 중…";
  window.close();

  window.setTimeout(() => {
    closePresentation.disabled = false;
    closePresentation.classList.remove("is-closing");
    closePresentation.classList.add("is-blocked");
    closePresentationLabel.textContent = "Ctrl+W로 닫기";
    closePresentation.setAttribute("aria-label", "Ctrl+W로 PPT 닫기");
    closePresentation.title = "브라우저 정책으로 자동 종료가 차단되었습니다. Ctrl+W를 눌러 닫아주세요.";
  }, 400);
});

applySlideMode();

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    setSlide(active + 1);
  }
  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    setSlide(active - 1);
  }
  if (event.key === "Home") setSlide(0);
  if (event.key === "End") setSlide(slides.length - 1);
});

const bg = document.querySelector("#ambient-bg");
const ctx = bg.getContext("2d");
let width = 0;
let height = 0;
let tick = 0;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = bg.width = Math.floor(window.innerWidth * ratio);
  height = bg.height = Math.floor(window.innerHeight * ratio);
  bg.style.width = `${window.innerWidth}px`;
  bg.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function paintAmbient() {
  tick += 0.005;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f6f4ee";
  ctx.fillRect(0, 0, w, h);

  const points = [
    [w * 0.2 + Math.sin(tick * 1.7) * 24, h * 0.18, "rgba(15,118,110,0.13)"],
    [w * 0.72, h * 0.28 + Math.cos(tick * 1.3) * 30, "rgba(216,95,69,0.12)"],
    [w * 0.48 + Math.cos(tick) * 20, h * 0.82, "rgba(201,154,46,0.13)"],
  ];

  points.forEach(([x, y, color], i) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * (0.28 + i * 0.04));
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(246,244,238,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });

  ctx.strokeStyle = "rgba(23,33,36,0.045)";
  ctx.lineWidth = 1;
  for (let x = -80; x < w + 80; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(tick * 2 + x) * 6, 0);
    ctx.lineTo(x - 180, h);
    ctx.stroke();
  }

  requestAnimationFrame(paintAmbient);
}

resize();
paintAmbient();
window.addEventListener("resize", resize);

function startWindowed(){presentationLoader.remove();frame.classList.add("is-ready");}
document.getElementById("windowed-start").addEventListener("click",startWindowed);
window.addEventListener("message",e=>{if(e.data?.type==="enis-twin-full"){document.body.classList.toggle("twin-full",!!e.data.on);}});
window.addEventListener("message",e=>{if(e.source!==frame.contentWindow)return;if(e.data?.type==="enis-slide-key"){if(e.data.key==="ArrowRight")setSlide(active+1);if(e.data.key==="ArrowLeft")setSlide(active-1);}});
