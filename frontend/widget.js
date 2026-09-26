(function() {
  // Use document.currentScript for reliable script reference (falls back to tag search)
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src.includes('widget.js')) return scripts[i];
    }
    return null;
  })();

  const rawClinicId = currentScript ? currentScript.getAttribute('data-clinic-id') : 'dr-sharma';
  // Sanitize clinicId to prevent XSS injection via data attributes
  const clinicId = encodeURIComponent(rawClinicId || 'dr-sharma');
  const themeColor = (currentScript ? currentScript.getAttribute('data-theme-color') : null) || '#10B981';
  const baseUrl = currentScript ? new URL(currentScript.src).origin : window.location.origin;


  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #swastik-ai-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #swastik-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background: linear-gradient(135deg, ${themeColor}, ${themeColor}cc);
      box-shadow: 0 4px 12px ${themeColor}66;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #swastik-widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px ${themeColor}99;
    }
    #swastik-widget-button svg {
      width: 28px;
      height: 28px;
      stroke: white;
    }
    #swastik-widget-panel {
      display: none;
      width: calc(100vw - 48px);
      max-width: 400px;
      height: calc(100vh - 120px);
      max-height: 600px;
      background: #18181b;
      border-radius: 16px;
      margin-bottom: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      overflow: hidden;
      flex-direction: column;
      border: 1px solid rgba(255,255,255,0.1);
    }
    #swastik-widget-panel.open {
      display: flex;
    }
    .sw-header {
      background: #27272a;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: white;
      font-weight: 600;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .sw-content {
      flex: 1;
      padding: 0;
      display: flex;
      flex-direction: column;
      background: #03060B;
    }
    .sw-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
    .sw-close {
      background: none;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  // Inject HTML
  const container = document.createElement('div');
  container.id = 'swastik-ai-widget';
  container.innerHTML = `
    <div id="swastik-widget-panel">
      <div class="sw-header">
        <span>AI Receptionist</span>
        <button class="sw-close" id="swastik-close-btn">✕</button>
      </div>
      <div class="sw-content">
        <iframe id="swastik-iframe" class="sw-iframe" src="about:blank" allow="microphone"></iframe>
      </div>
    </div>
    <button id="swastik-widget-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
      </svg>
    </button>
  `;
  document.body.appendChild(container);

  const btn = document.getElementById('swastik-widget-button');
  const panel = document.getElementById('swastik-widget-panel');
  const closeBtn = document.getElementById('swastik-close-btn');
  const iframe = document.getElementById('swastik-iframe');
  let loaded = false;

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (!loaded) {
      // Load the smart link inside the iframe
      const safeClinicId = encodeURIComponent(clinicId);
      iframe.src = `${baseUrl}/call/${safeClinicId}?embed=true`;
      loaded = true;
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
  });

})();
