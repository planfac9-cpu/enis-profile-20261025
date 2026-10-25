(function () {
  const slide = document.querySelector(".slide");
  let resizeFrame = 0;

  function fitSlide() {
    if (!slide) return;
    const isScrollSlide = slide.classList.contains("scroll-slide");
    document.documentElement.classList.toggle("scroll-html", isScrollSlide);
    document.body.classList.toggle("scroll-body", isScrollSlide);

    const scale = isScrollSlide
      ? window.innerWidth / 1920
      : Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    slide.style.setProperty("--slide-scale", String(scale));

    if (isScrollSlide) {
      const baseHeight = Math.max(slide.scrollHeight, slide.offsetHeight, 1080);
      const fittedHeight = Math.ceil(baseHeight * scale);
      document.documentElement.style.minHeight = `${fittedHeight}px`;
      document.body.style.height = `${fittedHeight}px`;
      document.body.style.minHeight = `${fittedHeight}px`;
      try {
        window.parent.postMessage(
          {
            type: "enis-scroll-slide",
            scrollable: true,
            height: fittedHeight,
            path: window.location.pathname,
          },
          "*"
        );
      } catch (error) {
        // Parent messaging is only a convenience for the deck shell.
      }
    } else {
      document.documentElement.style.minHeight = "";
      document.body.style.height = "";
      document.body.style.minHeight = "";
    }
  }

  function scheduleFitSlide() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitSlide);
  }

  function ensureWheelScroll() {
    if (!slide || !slide.classList.contains("scroll-slide") || window.__enisWheelScrollBound) return;
    window.__enisWheelScrollBound = true;

    window.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey) return;
        const root = document.scrollingElement || document.documentElement;
        const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
        if (!maxScroll) return;

        const before = root.scrollTop;
        const next = Math.max(0, Math.min(maxScroll, before + event.deltaY));
        if (next !== before) {
          root.scrollTop = next;
          document.documentElement.scrollTop = next;
          document.body.scrollTop = next;
          event.preventDefault();
        }
      },
      { passive: false }
    );
  }

  fitSlide();
  ensureWheelScroll();
  window.addEventListener("resize", scheduleFitSlide);
  window.addEventListener("load", scheduleFitSlide);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleFitSlide);
  }

  document.querySelectorAll("img, iframe").forEach((element) => {
    element.addEventListener("load", scheduleFitSlide);
  });

  if (slide) {
    const observer = new MutationObserver(scheduleFitSlide);
    observer.observe(slide, {
      childList: true,
      subtree: true,
    });
  }

  const canvases = document.querySelectorAll("[data-webgl-fallback]");

  canvases.forEach((canvas, index) => {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) return;

    const vertexSource = `
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec2 uv;
      uniform float time;
      uniform vec3 colorA;
      uniform vec3 colorB;
      void main() {
        vec2 p = uv - 0.5;
        float rings = sin((length(p) * 14.0) - time * 1.6) * 0.5 + 0.5;
        float sweep = smoothstep(-0.2, 0.85, uv.x + sin(time * 0.42 + uv.y * 5.0) * 0.18);
        vec3 color = mix(colorA, colorB, sweep);
        float light = 0.28 + rings * 0.2 + smoothstep(0.46, 0.0, length(p)) * 0.55;
        gl_FragColor = vec4(color * light, 1.0);
      }
    `;

    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      return result;
    }

    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "time");
    const colorA = gl.getUniformLocation(program, "colorA");
    const colorB = gl.getUniformLocation(program, "colorB");
    const palettes = [
      [[0.06, 0.45, 0.42], [0.82, 0.39, 0.26]],
      [[0.18, 0.36, 0.47], [0.77, 0.58, 0.18]],
      [[0.08, 0.38, 0.34], [0.72, 0.29, 0.22]],
    ];

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw(now) {
      resize();
      const palette = palettes[index % palettes.length];
      gl.uniform1f(timeLocation, now * 0.001);
      gl.uniform3fv(colorA, palette[0]);
      gl.uniform3fv(colorB, palette[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(draw);
    }

    draw(0);
  });
})();

window.addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();parent.postMessage({type:"enis-slide-key",key:e.key},"*");}});
