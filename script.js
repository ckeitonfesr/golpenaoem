const app = {
  boxes: null,
  spinning: false,
  firebaseInitialized: false,
  deviceId: null,
  spinDuration: 5000,
  spinSpeed: 100,
  spinDeceleration: true,
  
  init() {
    this.deviceId = this.getDeviceId();
    this.initFirebase();
    this.setupElements();
    this.setupEventListeners();
    this.restaurarEstado();
    this.trackPageView();
  },

  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  },

  async initFirebase() {
    if (!window.FIREBASE_CONFIGURED) {
      this.firebaseInitialized = false;
      return;
    }

    if (typeof firebase === 'undefined') {
      this.firebaseInitialized = false;
      return;
    }

    try {
      if (window.db) {
        this.db = window.db;
        this.firebaseInitialized = true;
        await this.registerDevice();
        await this.loadLayoutFromFirebase();
      } else {
        this.firebaseInitialized = false;
      }
    } catch (error) {
      this.firebaseInitialized = false;
    }
  },

  getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceName = 'Desconhecido';
    let deviceBrand = 'Desconhecido';
    
    if (/iPhone/i.test(ua)) {
      deviceBrand = 'Apple';
      if (/iPhone OS (\d+)_(\d+)/i.test(ua)) {
        deviceName = 'iPhone';
      }
    } else if (/iPad/i.test(ua)) {
      deviceBrand = 'Apple';
      deviceName = 'iPad';
    } else if (/Android/i.test(ua)) {
      deviceBrand = 'Android';
      const androidMatch = ua.match(/Android\s+([\d.]+)/);
      if (ua.match(/Mobile/)) {
        const manufacturerMatch = ua.match(/(Samsung|Xiaomi|Motorola|LG|Sony|Huawei|OnePlus|Realme|Oppo|Vivo|Nokia|Lenovo)/i);
        deviceBrand = manufacturerMatch ? manufacturerMatch[1] : 'Android';
        deviceName = 'Smartphone Android';
      } else {
        deviceName = 'Tablet Android';
      }
    } else if (/Windows/i.test(ua)) {
      deviceBrand = 'Microsoft';
      deviceName = 'Windows PC';
    } else if (/Mac/i.test(ua)) {
      deviceBrand = 'Apple';
      deviceName = 'Mac';
    } else if (/Linux/i.test(ua)) {
      deviceBrand = 'Linux';
      deviceName = 'Linux PC';
    }

    return {
      name: deviceName,
      brand: deviceBrand,
      platform: navigator.platform,
      userAgent: ua
    };
  },

  async getIPAddress() {
    const methods = [
      {
        name: 'ipify.org',
        url: 'https://api.ipify.org?format=json',
        type: 'json',
        field: 'ip'
      },
      {
        name: 'api64.ipify.org',
        url: 'https://api64.ipify.org?format=json',
        type: 'json',
        field: 'ip'
      },
      {
        name: 'ipapi.co',
        url: 'https://ipapi.co/ip/',
        type: 'text'
      },
      {
        name: 'httpbin.org',
        url: 'https://httpbin.org/ip',
        type: 'json',
        field: 'origin'
      },
      {
        name: 'ipwho.is',
        url: 'https://ipwho.is/',
        type: 'json',
        field: 'ip'
      }
    ];

    for (const method of methods) {
      try {
        console.log(`Tentando obter IP via ${method.name}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(method.url, {
          method: 'GET',
          headers: {
            'Accept': method.type === 'json' ? 'application/json' : 'text/plain'
          },
          signal: controller.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        let ip = null;
        
        if (method.type === 'json') {
          const data = await response.json();
          ip = method.field ? data[method.field] : data.ip;
        } else {
          ip = await response.text();
        }
        
        ip = ip?.toString().trim();
        
        if (ip && this.isValidIP(ip)) {
          console.log(`✅ IP obtido via ${method.name}:`, ip);
          return ip;
        } else {
          console.warn(`❌ IP inválido recebido de ${method.name}:`, ip);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn(`⏱️ Timeout ao obter IP via ${method.name}`);
        } else {
          console.warn(`❌ Erro ao obter IP via ${method.name}:`, error.message);
        }
        continue;
      }
    }
    
    console.error('❌ Todos os métodos de obtenção de IP falharam');
    return 'Desconhecido';
  },

  isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }
    
    return ipv6Regex.test(ip);
  },

  async getLocationByIP(ip) {
    if (!ip || ip === 'Desconhecido') {
      return null;
    }

    const apis = [
      {
        name: 'ipapi.co',
        url: `https://ipapi.co/${ip}/json/`,
        parse: (data) => {
          if (data.error) return null;
          return {
            ip: ip,
            country: data.country_name || 'Desconhecido',
            countryCode: data.country_code || '',
            region: data.region || 'Desconhecido',
            city: data.city || 'Desconhecido',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || 'Desconhecido',
            isp: data.org || 'Desconhecido',
            address: `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
          };
        }
      },
      {
        name: 'ip-api.com',
        url: `https://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp,query`,
        parse: (data) => {
          if (data.status === 'fail') return null;
          return {
            ip: ip,
            country: data.country || 'Desconhecido',
            countryCode: data.countryCode || '',
            region: data.regionName || 'Desconhecido',
            city: data.city || 'Desconhecido',
            latitude: data.lat || null,
            longitude: data.lon || null,
            timezone: data.timezone || 'Desconhecido',
            isp: data.isp || 'Desconhecido',
            address: `${data.city || ''}, ${data.regionName || ''}, ${data.country || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
          };
        }
      },
      {
        name: 'ipwho.is',
        url: `https://ipwho.is/${ip}`,
        parse: (data) => {
          if (data.success === false) return null;
          return {
            ip: ip,
            country: data.country || 'Desconhecido',
            countryCode: data.country_code || '',
            region: data.region || 'Desconhecido',
            city: data.city || 'Desconhecido',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone?.id || 'Desconhecido',
            isp: data.connection?.isp || 'Desconhecido',
            address: `${data.city || ''}, ${data.region || ''}, ${data.country || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
          };
        }
      },
      {
        name: 'ip-api.io',
        url: `https://ip-api.io/json/${ip}`,
        parse: (data) => {
          if (data.error) return null;
          return {
            ip: ip,
            country: data.country_name || 'Desconhecido',
            countryCode: data.country_code || '',
            region: data.region_name || 'Desconhecido',
            city: data.city || 'Desconhecido',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.time_zone?.name || 'Desconhecido',
            isp: data.organization || 'Desconhecido',
            address: `${data.city || ''}, ${data.region_name || ''}, ${data.country_name || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
          };
        }
      }
    ];

    for (const api of apis) {
      try {
        console.log(`Tentando obter localização via ${api.name}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(api.url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal,
          cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const location = api.parse(data);
        
        if (location && location.latitude && location.longitude) {
          console.log(`✅ Localização obtida via ${api.name}:`, location);
          return location;
        } else {
          console.warn(`❌ Localização inválida recebida de ${api.name}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn(`⏱️ Timeout ao obter localização via ${api.name}`);
        } else {
          console.warn(`❌ Erro ao obter localização via ${api.name}:`, error.message);
        }
        continue;
      }
    }
    
    console.error('❌ Todas as APIs de localização falharam');
    return null;
  },


  async registerDevice() {
    if (!this.firebaseInitialized || !this.db) {
      console.log('Firebase não inicializado - não será possível registrar dispositivo');
      return;
    }

    try {
      console.log('Iniciando registro do dispositivo...');
      const deviceRef = this.db.ref(`devices/${this.deviceId}`);
      const snapshot = await deviceRef.once('value');
      const deviceExists = snapshot.exists();
      const existingData = snapshot.val() || {};
      const deviceInfo = this.getDeviceInfo();
      const now = new Date();
      const timestamp = firebase.database.ServerValue.TIMESTAMP;
      
      console.log('Obtendo IP do dispositivo...');
      let ip = existingData.ip || 'Desconhecido';
      let ipLocation = existingData.ipLocation || null;
      
      if (!ip || ip === 'Desconhecido' || !ipLocation || !ipLocation.latitude) {
        try {
          ip = await this.getIPAddress();
          console.log('IP obtido:', ip);
          
          if (ip && ip !== 'Desconhecido') {
            console.log('Obtendo localização por IP...');
            ipLocation = await this.getLocationByIP(ip);
            console.log('Localização obtida:', ipLocation);
            
            if (!ipLocation || !ipLocation.latitude || !ipLocation.longitude) {
              console.warn('Localização não obtida, tentando novamente após 2 segundos...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              ipLocation = await this.getLocationByIP(ip);
              console.log('Tentativa 2 - Localização obtida:', ipLocation);
            }
          } else {
            console.warn('IP não foi obtido ou é desconhecido');
          }
        } catch (ipError) {
          console.error('Erro ao obter IP ou localização:', ipError);
        }
      }
      
      const deviceData = {
        deviceId: this.deviceId,
        deviceName: deviceInfo.name,
        deviceBrand: deviceInfo.brand,
        platform: deviceInfo.platform,
        userAgent: deviceInfo.userAgent,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timestamp: deviceExists ? existingData.timestamp : timestamp,
        horaRegistro: deviceExists ? existingData.horaRegistro : now.toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        lastAccess: timestamp,
        isNew: !deviceExists,
        ip: ip,
        ipLocation: ipLocation
      };

      console.log('Salvando dados do dispositivo:', { ip, hasLocation: !!ipLocation, isNew: !deviceExists });
      
      await deviceRef.set(deviceData);
      
      if (!ipLocation && ip && ip !== 'Desconhecido') {
        console.log('Tentando atualizar localização em background...');
        setTimeout(async () => {
          try {
            const location = await this.getLocationByIP(ip);
            if (location && location.latitude && location.longitude) {
              await deviceRef.update({ ipLocation: location });
              console.log('✅ Localização atualizada em background!');
            }
          } catch (e) {
            console.error('Erro ao atualizar localização em background:', e);
          }
        }, 3000);
      }

      if (!deviceExists) {
        const analyticsRef = this.db.ref('analytics/newDevices');
        const analyticsSnapshot = await analyticsRef.once('value');
        const currentCount = analyticsSnapshot.val()?.count || 0;
        await analyticsRef.set({
          count: currentCount + 1,
          lastUpdate: timestamp
        });
      }
    } catch (error) {
      console.error('Erro ao registrar dispositivo:', error);
      this.firebaseInitialized = false;
    }
  },

  async trackEvent(eventName, eventData = {}) {
  },

  async trackPageView() {
  },

  async loadLayoutFromFirebase() {
    if (!this.firebaseInitialized || !this.db) {
      const localLayout = localStorage.getItem('localLayout');
      if (localLayout) {
        try {
          const layout = JSON.parse(localLayout);
          this.applyLayout(layout);
        } catch (e) {
        }
      }
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      
      const snapshot = await layoutRef.once('value');
      if (snapshot.exists()) {
        const layout = snapshot.val();
        this.applyLayout(layout);
        localStorage.setItem('localLayout', JSON.stringify(layout));
      }
      
      layoutRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
          const layout = snapshot.val();
          this.applyLayout(layout);
          localStorage.setItem('localLayout', JSON.stringify(layout));
        }
      });
    } catch (error) {
      this.firebaseInitialized = false;
      const localLayout = localStorage.getItem('localLayout');
      if (localLayout) {
        try {
          const layout = JSON.parse(localLayout);
          this.applyLayout(layout);
        } catch (e) {
        }
      }
    }
  },

  applyLayout(layout) {
    const container = document.querySelector('.container');
    const heroTitle = document.getElementById('heroTitleText');
    const heroSubtitle = document.getElementById('heroSubtitle');
    const heroSection = document.getElementById('heroSection');
    const spinButton = document.getElementById('spinButton');
    
    if (layout.images && this.boxes) {
      layout.images.forEach((imageUrl, index) => {
        if (imageUrl && this.boxes[index]) {
          this.boxes[index].style.backgroundImage = `url(${imageUrl})`;
          this.boxes[index].style.backgroundSize = 'cover';
          this.boxes[index].style.backgroundPosition = 'center';
        }
      });
    }
    
    if (layout.backgroundColor) {
      if (layout.backgroundColorSecondary) {
        document.body.style.background = `linear-gradient(135deg, ${layout.backgroundColor} 0%, ${layout.backgroundColorSecondary} 100%)`;
      } else {
        document.body.style.backgroundColor = layout.backgroundColor;
      }
    }
    
    if (layout.buttonColor) {
      if (spinButton) {
        spinButton.style.backgroundColor = layout.buttonColor;
      }
      document.documentElement.style.setProperty('--primary', layout.buttonColor);
    }
    
    if (layout.buttonHoverColor) {
      document.documentElement.style.setProperty('--primary-dark', layout.buttonHoverColor);
    }
    
    if (layout.accentColor) {
      document.documentElement.style.setProperty('--accent', layout.accentColor);
    }
    
    if (layout.heroTitle && heroTitle) {
      heroTitle.textContent = layout.heroTitle;
    }
    
    if (layout.heroSubtitle && heroSubtitle) {
      heroSubtitle.textContent = layout.heroSubtitle;
    }
    
    if (layout.heroTitleSize) {
      const titleEl = document.getElementById('heroTitle');
      if (titleEl) {
        titleEl.style.fontSize = `${layout.heroTitleSize}px`;
      }
    }
    
    if (layout.heroSubtitleSize) {
      if (heroSubtitle) {
        heroSubtitle.style.fontSize = `${layout.heroSubtitleSize}px`;
      }
    }
    
    if (layout.heroTitleColor) {
      const titleEl = document.getElementById('heroTitle');
      if (titleEl) {
        titleEl.style.color = layout.heroTitleColor;
      }
    }
    
    if (layout.heroSubtitleColor && heroSubtitle) {
      heroSubtitle.style.color = layout.heroSubtitleColor;
    }
    
    if (layout.spacing) {
      if (layout.spacing.containerPadding !== undefined && container) {
        container.style.padding = `${layout.spacing.containerPadding}px`;
      }
      if (layout.spacing.heroMarginTop !== undefined && heroSection) {
        heroSection.style.marginTop = `${layout.spacing.heroMarginTop}px`;
      }
      if (layout.spacing.heroMarginBottom !== undefined && heroSection) {
        heroSection.style.marginBottom = `${layout.spacing.heroMarginBottom}px`;
      }
    }
    
    if (layout.roulette) {
      const config = layout.roulette;
      
      if (config.design) {
        container.classList.remove('design-grid', 'design-circular', 'design-linear');
        container.classList.add(`design-${config.design}`);
      }
      
      container.classList.remove('animation-bounce', 'animation-pulse', 'animation-shake', 'animation-rotate', 'animation-glow');
      if (config.animation && config.animation !== 'none') {
        container.classList.add(`animation-${config.animation}`);
      }
      
      if (config.boxSize) {
        this.boxes.forEach(box => {
          box.style.width = `${config.boxSize}px`;
          box.style.height = `${config.boxSize}px`;
        });
      }
      
      if (config.containerWidth) {
        container.style.width = config.containerWidth;
        if (config.containerWidth !== 'auto') {
          container.style.maxWidth = config.containerWidth;
        } else {
          container.style.maxWidth = '';
        }
      }
      
      if (config.gap !== undefined) {
        container.style.gap = `${config.gap}px`;
      }
      
      if (config.enableDragDrop === false) {
        this.boxes.forEach(box => {
          box.setAttribute('draggable', 'false');
        });
      } else {
        this.boxes.forEach(box => {
          box.setAttribute('draggable', 'true');
        });
      }
    } else {
      if (!container.classList.contains('design-grid') && 
          !container.classList.contains('design-circular') && 
          !container.classList.contains('design-linear')) {
        container.classList.add('design-grid');
      }
    }
    
    if (layout.spin) {
      if (layout.spin.duration) {
        this.spinDuration = layout.spin.duration;
      }
      if (layout.spin.speed) {
        this.spinSpeed = layout.spin.speed;
      }
      if (layout.spin.deceleration !== undefined) {
        this.spinDeceleration = layout.spin.deceleration;
      }
    }
    
    this.applyBackgroundAnimation(layout.backgroundAnimation);
  },
  
  applyBackgroundAnimation(config) {
    if (!config || !config.type || config.type === 'none') {
      document.body.classList.remove('bg-animation-gradient', 'bg-animation-particles', 'bg-animation-waves', 'bg-animation-grid', 'bg-animation-stars');
      const existingBg = document.getElementById('backgroundAnimation');
      if (existingBg) {
        existingBg.remove();
      }
      return;
    }
    
    document.body.classList.remove('bg-animation-gradient', 'bg-animation-particles', 'bg-animation-waves', 'bg-animation-grid', 'bg-animation-stars');
    document.body.classList.add(`bg-animation-${config.type}`);
    
    const speed = config.speed || 5;
    const opacity = config.opacity !== undefined ? config.opacity : 30;
    const animationDuration = Math.max(10, 25 - (speed - 1) * 2);
    
    document.documentElement.style.setProperty('--animation-speed', `${animationDuration}s`);
    document.documentElement.style.setProperty('--animation-opacity', `${opacity}%`);
    
    let bgElement = document.getElementById('backgroundAnimation');
    if (!bgElement && (config.type === 'particles' || config.type === 'stars')) {
      bgElement = document.createElement('div');
      bgElement.id = 'backgroundAnimation';
      document.body.appendChild(bgElement);
    } else if (bgElement && (config.type !== 'particles' && config.type !== 'stars')) {
      bgElement.remove();
      bgElement = null;
    }
    
    if (bgElement) {
      bgElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        opacity: ${opacity / 100};
      `;
    }
    
    if (config.type === 'particles' && bgElement) {
      bgElement.innerHTML = '';
      const particleCount = 80;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 4 + 2;
        const delay = Math.random() * animationDuration;
        particle.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.8), rgba(99, 102, 241, 0.3));
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation: float ${animationDuration + Math.random() * 5}s infinite ease-in-out ${delay}s;
          box-shadow: 0 0 ${size * 2}px rgba(99, 102, 241, 0.5);
        `;
        bgElement.appendChild(particle);
      }
    } else if (config.type === 'stars' && bgElement) {
      bgElement.innerHTML = '';
      const starCount = 150;
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        const size = Math.random() * 3 + 1;
        const delay = Math.random() * animationDuration;
        star.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: white;
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation: twinkle ${(animationDuration * 0.3) + Math.random() * (animationDuration * 0.3)}s infinite ${delay}s;
          box-shadow: 0 0 ${size * 3}px rgba(255, 255, 255, 0.8);
        `;
        bgElement.appendChild(star);
      }
    }
  },
  
  swapBoxes(index1, index2) {
    const box1 = this.boxes[index1];
    const box2 = this.boxes[index2];
    
    if (!box1 || !box2) return;
    
    const bg1 = window.getComputedStyle(box1).backgroundImage;
    const bg2 = window.getComputedStyle(box2).backgroundImage;
    
    box1.style.backgroundImage = bg2;
    box2.style.backgroundImage = bg1;
    
    const temp = box1.getAttribute('data-index');
    box1.setAttribute('data-index', box2.getAttribute('data-index'));
    box2.setAttribute('data-index', temp);
    
    const [box1Element, box2Element] = [this.boxes[index1], this.boxes[index2]];
    this.boxes[index1] = box2Element;
    this.boxes[index2] = box1Element;
  },

  setupElements() {
    this.boxes = document.querySelectorAll('.image-box');
    this.input = document.getElementById('playerId');
    this.spinButton = document.getElementById('spinButton');
    this.overlay = document.getElementById('overlay');
    this.closeOverlay = document.getElementById('closeOverlay');
    this.selectedImagesContainer = document.getElementById('selectedImagesContainer');
    this.playerName = document.getElementById('playerName');
    this.playerLevel = document.getElementById('playerLevel');
    this.playerAvatar = document.getElementById('playerAvatar');
    this.lowPlayer = document.getElementById('lowplayer');
  },

  setupEventListeners() {
    document.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
      }
    });
    document.addEventListener('drop', (e) => {
      if (!e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
      }
    });

    this.boxes.forEach((box, index) => {
      box.setAttribute('draggable', 'true');
      
      box.addEventListener('dragstart', (e) => {
        if (e.dataTransfer.files.length === 0) {
          e.dataTransfer.setData('text/plain', index.toString());
          e.dataTransfer.effectAllowed = 'move';
          box.classList.add('dragging');
        }
      });
      
      box.addEventListener('dragend', () => {
        box.classList.remove('dragging');
        this.boxes.forEach(b => b.classList.remove('drag-over'));
      });
      
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('text/plain')) {
          box.classList.add('drag-over');
        } else if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
        }
      });
      
      box.addEventListener('dragleave', () => {
        box.classList.remove('drag-over');
      });
      
      box.addEventListener('drop', (e) => {
        e.preventDefault();
        box.classList.remove('drag-over');
        
        if (e.dataTransfer.types.includes('text/plain')) {
          const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
          if (draggedIndex !== index) {
            this.swapBoxes(draggedIndex, index);
          }
        } else if (e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file) {
            this.aplicarImagemEmElemento(file, box);
            this.trackEvent('image_upload', { index });
          }
        }
      });

      box.addEventListener('click', () => {
        if (this.spinning) return;
        box.classList.toggle('selected');
        this.trackEvent('image_select', { index, selected: box.classList.contains('selected') });
      });
    });

    document.body.addEventListener('drop', (e) => {
      const dropTarget = e.target.closest('.image-box');
      if (dropTarget) return;
      const file = e.dataTransfer.files[0];
      if (file) {
        this.aplicarImagemEmElemento(file, document.body);
        this.trackEvent('background_upload');
      }
    });

    this.input.addEventListener('input', () => {
      this.input.value = this.input.value.replace(/\D/g, '').slice(0, 13);
    });

    this.spinButton.addEventListener('click', () => {
      this.handleSpin();
      this.trackEvent('spin_button_click');
    });

    this.closeOverlay.addEventListener('click', () => {
      this.closeOverlayFunc();
      this.trackEvent('close_overlay');
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.closeOverlayFunc();
      }
    });

    document.querySelectorAll('[data-track]').forEach(element => {
      element.addEventListener('click', () => {
        this.trackEvent(element.dataset.track);
      });
    });

    document.querySelector('.btn-generate-nick')?.addEventListener('click', () => {
      document.getElementById('nickGeneratorModal').classList.add('show');
      this.trackEvent('open_nick_generator');
    });

    document.querySelector('[data-track="close-nick-modal"]')?.addEventListener('click', () => {
      document.getElementById('nickGeneratorModal').classList.remove('show');
    });

    document.getElementById('generateNickBtn')?.addEventListener('click', () => {
      this.generateNick();
      this.trackEvent('generate_nick');
    });

    document.getElementById('copyNickBtn')?.addEventListener('click', () => {
      this.copyNick();
      this.trackEvent('copy_nick');
    });
  },

  salvarEstado() {
    const estado = [];
    this.boxes.forEach(box => {
      const bg = box.style.backgroundImage || '';
      estado.push(bg);
    });
    localStorage.setItem('only-royale-images', JSON.stringify(estado));

    const bodyBg = document.body.style.backgroundImage || '';
    if (bodyBg) {
      localStorage.setItem('only-royale-body-bg', bodyBg);
    }
  },

  restaurarEstado() {
    const estadoSalvo = localStorage.getItem('only-royale-images');
    if (!estadoSalvo) return;

    const estado = JSON.parse(estadoSalvo);
    estado.forEach((bg, i) => {
      if (bg && bg !== 'none' && bg !== '' && this.boxes[i]) {
        this.boxes[i].style.backgroundImage = bg;
        this.boxes[i].style.backgroundSize = 'cover';
        this.boxes[i].style.backgroundPosition = 'center';
        this.boxes[i].style.backgroundRepeat = 'no-repeat';
      }
    });

    const bodyBg = localStorage.getItem('only-royale-body-bg');
    if (bodyBg && bodyBg !== 'none' && bodyBg !== '') {
      document.body.style.backgroundImage = bodyBg;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    }
  },

  aplicarImagemEmElemento(file, elemento) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor, solte uma imagem válida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      elemento.style.backgroundImage = `url(${event.target.result})`;
      elemento.style.backgroundSize = 'cover';
      elemento.style.backgroundPosition = 'center';
      elemento.style.backgroundRepeat = 'no-repeat';
      this.salvarEstado();
    };
    reader.readAsDataURL(file);
  },

  async buscarDadosDoJogador(uid) {
    try {
      const response = await fetch(`/api/freefire?uid=${uid}`);
      if (!response.ok) throw new Error('Erro na resposta');

      const data = await response.json();
      const nickname = data.nickname;
      const level = data.level;
      const avatarUrl = data.avatar || data.avatarUrl;

      if (nickname) {
        this.playerName.textContent = nickname;
      }
      if (level) {
        this.playerLevel.textContent = `Level: ${level}`;
      }
      if (avatarUrl) {
        this.playerAvatar.src = avatarUrl;
        this.playerAvatar.style.display = 'block';
      } else {
        this.playerAvatar.style.display = 'none';
      }

      await this.trackEvent('player_search', { uid, nickname, level });
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      this.playerName.textContent = 'Jogador não encontrado';
      this.playerLevel.textContent = '';
      this.playerAvatar.style.display = 'none';
    }
  },

  handleSpin() {
    if (this.spinning) return;
    this.spinning = true;
    this.spinButton.disabled = true;

    const uid = this.input.value.trim();

    this.selectedImagesContainer.innerHTML = '';
    this.playerName.textContent = '';
    this.playerLevel.textContent = '';
    this.playerAvatar.style.display = 'none';
    this.lowPlayer.textContent = '';

    const selectedBoxes = document.querySelectorAll('.image-box.selected');

    if (selectedBoxes.length > 0) {
      selectedBoxes.forEach(box => {
        const bg = window.getComputedStyle(box).backgroundImage;
        if (!bg || bg === 'none') return;

        const img = document.createElement('div');
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.backgroundImage = bg;
        img.style.backgroundSize = 'cover';
        img.style.backgroundPosition = 'center';
        img.style.border = '3px solid #10b981';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
        this.selectedImagesContainer.appendChild(img);
      });

      this.overlay.classList.add('show');
      this.spinning = false;
      this.spinButton.disabled = false;

      if (uid.length >= 5) {
        this.buscarDadosDoJogador(uid);
      }

      this.boxes.forEach(box => box.classList.remove('selected'));
      this.trackEvent('spin_selected_images', { count: selectedBoxes.length });
      return;
    }

    const totalDuration = this.spinDuration || 5000;
    const intervalTime = this.spinSpeed || 100;
    let elapsed = 0;
    let currentIndex = 0;
    let speedMultiplier = 1;

    this.boxes.forEach(box => box.classList.remove('highlight'));

    const spinner = setInterval(() => {
      this.boxes.forEach(box => box.classList.remove('highlight'));
      this.boxes[currentIndex].classList.add('highlight');

      currentIndex = (currentIndex + 1) % this.boxes.length;
      elapsed += intervalTime * speedMultiplier;
      
      if (this.spinDeceleration !== false && elapsed > totalDuration * 0.6) {
        speedMultiplier = Math.min(speedMultiplier * 1.15, 8);
      }

      if (elapsed >= totalDuration) {
        clearInterval(spinner);
        speedMultiplier = 1;

        const chosenIndex = Math.floor(Math.random() * this.boxes.length);
        const chosenBox = this.boxes[chosenIndex];

        this.boxes.forEach(box => box.classList.remove('highlight'));
        chosenBox.classList.add('highlight');
        chosenBox.classList.remove('selected');

        const backgroundImage = window.getComputedStyle(chosenBox).backgroundImage;

        if (!backgroundImage || backgroundImage === 'none') {
          alert('Imagem inválida. Por favor, adicione uma imagem primeiro.');
          this.spinning = false;
          this.spinButton.disabled = false;
          return;
        }

        const img = document.createElement('div');
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.backgroundImage = backgroundImage;
        img.style.backgroundSize = 'cover';
        img.style.backgroundPosition = 'center';
        img.style.border = '3px solid #10b981';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
        this.selectedImagesContainer.appendChild(img);

        this.overlay.classList.add('show');
        this.spinning = false;
        this.spinButton.disabled = false;

        if (uid.length >= 5) {
          this.buscarDadosDoJogador(uid);
        }

        this.trackEvent('spin_complete', { chosenIndex });
        
        if (this.firebaseInitialized && this.db) {
          this.saveSelectedItem(chosenIndex);
        }
      }
    }, intervalTime);
  },

  async saveSelectedItem(index) {
    if (!this.firebaseInitialized || !this.db) return;
    
    try {
      const itemsRef = this.db.ref(`analytics/selectedItems/${index}`);
      const snapshot = await itemsRef.once('value');
      const currentCount = snapshot.val() || 0;
      await itemsRef.set(currentCount + 1);
      console.log(`Item ${index} selecionado! Total: ${currentCount + 1}`);
    } catch (error) {
      console.error('Erro ao salvar item selecionado:', error);
    }
  },

  closeOverlayFunc() {
    this.overlay.classList.remove('show');
    this.selectedImagesContainer.innerHTML = '';
    this.playerName.textContent = '';
    this.playerLevel.textContent = '';
    this.playerAvatar.style.display = 'none';
    this.playerAvatar.src = '';
    this.lowPlayer.textContent = '';
    this.boxes.forEach(box => box.classList.remove('highlight'));
    this.input.value = '';
  },

  generateNick() {
    const style = document.getElementById('nickStyle').value;
    const nick = this.getNickByStyle(style);
    const nickElement = document.getElementById('generatedNick');
    const copyBtn = document.getElementById('copyNickBtn');

    nickElement.textContent = nick;
    copyBtn.style.display = 'block';
    this.currentNick = nick;
  },

  getNickByStyle(style) {
    const nicks = {
      pro: [
        'ProKiller', 'EliteSniper', 'MasterShot', 'TopFragger', 'AcePlayer',
        'ProGamer', 'EliteWarrior', 'MasterTactics', 'TopRank', 'AceLegend',
        'ProHunter', 'EliteForce', 'MasterPro', 'TopGun', 'AceWinner'
      ],
      cool: [
        'CoolShadow', 'DarkKnight', 'IceCold', 'FireStorm', 'ThunderBolt',
        'NightWolf', 'DarkPhoenix', 'IceDragon', 'FireBlade', 'ThunderStrike',
        'ShadowHunter', 'DarkLegend', 'IceKing', 'FireLord', 'ThunderGod'
      ],
      brazil: [
        'BRPro', 'BrasilElite', 'BRMaster', 'BrasilTop', 'BRAce',
        'BRKiller', 'BrasilWarrior', 'BRHunter', 'BrasilForce', 'BRWinner',
        'BRLegend', 'BrasilPro', 'BRChampion', 'BrasilKing', 'BRHero'
      ],
      fire: [
        'FireKiller', 'FlameMaster', 'BlazePro', 'InfernoElite', 'PhoenixRise',
        'FireStorm', 'FlameWarrior', 'BlazeHunter', 'InfernoForce', 'PhoenixKing',
        'FireLord', 'FlameLegend', 'BlazeAce', 'InfernoPro', 'PhoenixElite'
      ],
      legend: [
        'LegendKiller', 'MythicPro', 'EpicMaster', 'DivineElite', 'ImmortalAce',
        'LegendWarrior', 'MythicHunter', 'EpicForce', 'DivinePro', 'ImmortalKing',
        'LegendLord', 'MythicLegend', 'EpicAce', 'DivineMaster', 'ImmortalElite'
      ],
      random: [
        'XxKillerxX', 'ProGamer2024', 'EliteShot', 'MasterTactics', 'TopRank',
        'AcePlayer', 'ShadowHunter', 'DarkKnight', 'FireBlade', 'IceDragon',
        'ThunderBolt', 'NightWolf', 'PhoenixRise', 'BlazePro', 'InfernoElite'
      ]
    };

    const styleNicks = nicks[style] || nicks.random;
    const randomNick = styleNicks[Math.floor(Math.random() * styleNicks.length)];
    const numbers = Math.floor(Math.random() * 9999);
    return randomNick + numbers;
  },

  copyNick() {
    if (!this.currentNick) return;

    navigator.clipboard.writeText(this.currentNick).then(() => {
      const btn = document.getElementById('copyNickBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
      btn.style.background = '#10b981';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 2000);
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
