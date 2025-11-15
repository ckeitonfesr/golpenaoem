const app = {
  boxes: null,
  spinning: false,
  firebaseInitialized: false,
  deviceId: null,
  spinDuration: 5000,
  spinSpeed: 100,
  spinDeceleration: true,
  positioningHandlers: null,
  freePositioningEnabled: false,
  
  init() {
    this.checkPreviewMode();
    
    this.deviceId = this.getDeviceId();
    this.initFirebase();
    this.setupElements();
    this.setupEventListeners();
    this.restaurarEstado();
    this.trackPageView();
  },

  checkPreviewMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true' || window.self !== window.top;
    
    if (isPreview) {
      const header = document.querySelector('.header');
      const footer = document.querySelector('.footer');
      
      if (header) {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
        header.style.height = '0';
        header.style.overflow = 'hidden';
      }
      if (footer) {
        footer.style.display = 'none';
        footer.style.visibility = 'hidden';
        footer.style.height = '0';
        footer.style.overflow = 'hidden';
      }
      
      const main = document.querySelector('.main');
      if (main) {
        main.style.paddingTop = '0';
        main.style.paddingBottom = '0';
        main.style.marginTop = '0';
        main.style.marginBottom = '0';
      }
      
      document.body.style.overflow = 'auto';
    }
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
    console.log('🔄 Carregando layout do Firebase...', {
      firebaseInitialized: this.firebaseInitialized,
      db: !!this.db
    });
    
    if (!this.firebaseInitialized || !this.db) {
      console.log('⚠️ Firebase não inicializado, tentando carregar do localStorage');
      const localLayout = localStorage.getItem('localLayout');
      if (localLayout) {
        try {
          const layout = JSON.parse(localLayout);
          console.log('📦 Layout do localStorage:', layout);
          this.applyLayout(layout);
        } catch (e) {
          console.error('❌ Erro ao parsear layout do localStorage:', e);
        }
      }
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      
      const snapshot = await layoutRef.once('value');
      if (snapshot.exists()) {
        const layout = snapshot.val();
        console.log('✅ Layout carregado do Firebase:', layout);
        this.applyLayout(layout);
        localStorage.setItem('localLayout', JSON.stringify(layout));
      } else {
        console.log('⚠️ Nenhum layout encontrado no Firebase');
      }
      
      layoutRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
          const layout = snapshot.val();
          console.log('🔄 Layout atualizado do Firebase:', layout);
          this.applyLayout(layout);
          localStorage.setItem('localLayout', JSON.stringify(layout));
        }
      });
    } catch (error) {
      console.error('❌ Erro ao carregar layout do Firebase:', error);
      this.firebaseInitialized = false;
      const localLayout = localStorage.getItem('localLayout');
      if (localLayout) {
        try {
          const layout = JSON.parse(localLayout);
          console.log('📦 Usando layout do localStorage como fallback');
          this.applyLayout(layout);
        } catch (e) {
          console.error('❌ Erro ao parsear layout do localStorage:', e);
        }
      }
    }
  },

  applyLayout(layout) {
    console.log('🎨 Aplicando layout:', layout);
    const container = document.querySelector('.container');
    const heroTitle = document.getElementById('heroTitleText');
    const heroSubtitle = document.getElementById('heroSubtitle');
    const heroSection = document.getElementById('heroSection');
    const spinButton = document.getElementById('spinButton');
    
    if (!container) {
      console.error('❌ Container não encontrado!');
      return;
    }
    
    if (layout.images && this.boxes) {
      layout.images.forEach((imageUrl, index) => {
        if (imageUrl && this.boxes[index]) {
          this.boxes[index].style.backgroundImage = `url(${imageUrl})`;
          this.boxes[index].style.backgroundSize = 'cover';
          this.boxes[index].style.backgroundPosition = 'center';
        }
      });
    }
    
    if (layout.backgroundMedia) {
      const media = layout.backgroundMedia;
      
      if (media.videoUrl) {
        let videoBg = document.getElementById('backgroundVideo');
        if (!videoBg) {
          videoBg = document.createElement('video');
          videoBg.id = 'backgroundVideo';
          videoBg.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: -1;
            opacity: ${media.overlayOpacity / 100};
          `;
          document.body.appendChild(videoBg);
        }
        videoBg.src = media.videoUrl;
        videoBg.loop = media.videoLoop !== false;
        videoBg.autoplay = media.videoAutoplay !== false;
        videoBg.muted = true;
        videoBg.play().catch(e => console.log('Video autoplay prevented:', e));
        videoBg.style.opacity = media.overlayOpacity / 100;
      } else {
        const videoBg = document.getElementById('backgroundVideo');
        if (videoBg) videoBg.remove();
      }
      
      if (media.imageUrl && !media.videoUrl) {
        document.body.style.backgroundImage = `url(${media.imageUrl})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        if (media.overlayOpacity < 100) {
          let overlay = document.getElementById('backgroundOverlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'backgroundOverlay';
            overlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: ${layout.backgroundColor || '#0f172a'};
              opacity: ${1 - (media.overlayOpacity / 100)};
              z-index: -1;
              pointer-events: none;
            `;
            document.body.appendChild(overlay);
          } else {
            overlay.style.opacity = 1 - (media.overlayOpacity / 100);
          }
        } else {
          const overlay = document.getElementById('backgroundOverlay');
          if (overlay) overlay.remove();
        }
      } else if (!media.imageUrl && !media.videoUrl) {
        document.body.style.backgroundImage = '';
        const overlay = document.getElementById('backgroundOverlay');
        if (overlay) overlay.remove();
      }
    }
    
    if (layout.backgroundColor) {
      if (!layout.backgroundMedia?.imageUrl && !layout.backgroundMedia?.videoUrl) {
        if (layout.backgroundColorSecondary) {
          document.body.style.background = `linear-gradient(135deg, ${layout.backgroundColor} 0%, ${layout.backgroundColorSecondary} 100%)`;
          console.log('✅ Background gradient:', layout.backgroundColor, layout.backgroundColorSecondary);
        } else {
          document.body.style.backgroundColor = layout.backgroundColor;
          console.log('✅ Background color:', layout.backgroundColor);
        }
      } else {
        let overlay = document.getElementById('backgroundOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'backgroundOverlay';
          overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none;';
          document.body.appendChild(overlay);
        }
        overlay.style.background = layout.backgroundColorSecondary 
          ? `linear-gradient(135deg, ${layout.backgroundColor} 0%, ${layout.backgroundColorSecondary} 100%)`
          : layout.backgroundColor;
        console.log('✅ Background overlay color aplicado');
      }
    }
    
    if (layout.buttonColor) {
      document.documentElement.style.setProperty('--primary', layout.buttonColor);
      if (spinButton) {
        spinButton.style.setProperty('--primary', layout.buttonColor);
      }
      console.log('✅ Button color:', layout.buttonColor);
    }
    
    if (layout.buttonHoverColor) {
      document.documentElement.style.setProperty('--primary-dark', layout.buttonHoverColor);
      if (spinButton) {
        spinButton.style.setProperty('--primary-dark', layout.buttonHoverColor);
      }
      console.log('✅ Button hover color:', layout.buttonHoverColor);
    }
    
    if (layout.accentColor) {
      document.documentElement.style.setProperty('--accent', layout.accentColor);
      console.log('✅ Accent color:', layout.accentColor);
    }
    
    if (layout.heroTitle && heroTitle) {
      heroTitle.textContent = layout.heroTitle;
      console.log('✅ Hero title:', layout.heroTitle);
    }
    
    if (layout.heroSubtitle && heroSubtitle) {
      heroSubtitle.textContent = layout.heroSubtitle;
      console.log('✅ Hero subtitle:', layout.heroSubtitle);
    }
    
    if (layout.heroTitleSize) {
      const titleEl = document.getElementById('heroTitle');
      if (titleEl) {
        titleEl.style.fontSize = `${layout.heroTitleSize}px`;
        console.log('✅ Hero title size:', layout.heroTitleSize);
      }
    }
    
    if (layout.heroSubtitleSize && heroSubtitle) {
      heroSubtitle.style.fontSize = `${layout.heroSubtitleSize}px`;
      console.log('✅ Hero subtitle size:', layout.heroSubtitleSize);
    }
    
    if (layout.heroTitleColor) {
      const titleEl = document.getElementById('heroTitle');
      if (titleEl) {
        titleEl.style.color = layout.heroTitleColor;
        console.log('✅ Hero title color:', layout.heroTitleColor);
      }
    }
    
    if (layout.heroSubtitleColor && heroSubtitle) {
      heroSubtitle.style.color = layout.heroSubtitleColor;
      console.log('✅ Hero subtitle color:', layout.heroSubtitleColor);
    }
    
    if (layout.spacing && !layout.container?.padding) {
      console.log('📏 Aplicando espaçamentos:', layout.spacing);
      if (layout.spacing.containerPadding !== undefined && container) {
        container.style.padding = `${layout.spacing.containerPadding}px`;
        console.log('✅ Padding do container:', layout.spacing.containerPadding);
      }
      if (layout.spacing.heroMarginTop !== undefined && heroSection) {
        heroSection.style.marginTop = `${layout.spacing.heroMarginTop}px`;
        console.log('✅ Margin top do hero:', layout.spacing.heroMarginTop);
      }
      if (layout.spacing.heroMarginBottom !== undefined && heroSection) {
        heroSection.style.marginBottom = `${layout.spacing.heroMarginBottom}px`;
        console.log('✅ Margin bottom do hero:', layout.spacing.heroMarginBottom);
      }
    }
    
    if (layout.roulette) {
      const config = layout.roulette;
      console.log('🎲 Aplicando configurações da roleta:', config);
      
      if (config.design) {
        container.classList.remove('design-grid', 'design-circular', 'design-linear');
        container.classList.add(`design-${config.design}`);
        console.log('✅ Design da roleta:', config.design);
      }
      
      container.classList.remove('animation-bounce', 'animation-pulse', 'animation-shake', 'animation-rotate', 'animation-glow');
      if (config.animation && config.animation !== 'none') {
        container.classList.add(`animation-${config.animation}`);
        console.log('✅ Animação dos itens:', config.animation);
      }
      
      if (config.boxSize && this.boxes && this.boxes.length > 0) {
        this.boxes.forEach(box => {
          box.style.width = `${config.boxSize}px`;
          box.style.height = `${config.boxSize}px`;
        });
        console.log('✅ Tamanho dos itens:', config.boxSize);
      }
      
      if (config.containerWidth) {
        container.style.width = config.containerWidth;
        if (config.containerWidth !== 'auto') {
          container.style.maxWidth = config.containerWidth;
        } else {
          container.style.maxWidth = '';
        }
        console.log('✅ Largura do container:', config.containerWidth);
      }
      
      if (config.gap !== undefined) {
        container.style.gap = `${config.gap}px`;
        console.log('✅ Gap:', config.gap);
      }
      
      if (config.enableDragDrop === false) {
        this.boxes.forEach(box => {
          box.setAttribute('draggable', 'false');
        });
      } else if (config.enableDragDrop === true) {
        this.boxes.forEach(box => {
          box.setAttribute('draggable', 'true');
        });
      } else {
        this.boxes.forEach(box => {
          box.setAttribute('draggable', 'true');
        });
      }

      if (layout.container) {
        const containerConfig = layout.container;
        
        container.classList.remove('container-animation-pulse', 'container-animation-glow', 
          'container-animation-float', 'container-animation-rotate', 'container-animation-shimmer');
        if (containerConfig.animation && containerConfig.animation !== 'none') {
          container.classList.add(`container-animation-${containerConfig.animation}`);
          const speed = containerConfig.animationSpeed || 5;
          container.style.setProperty('--animation-speed', `${11 - speed}s`);
        }
        
        if (containerConfig.borderWidth !== undefined) {
          container.style.borderWidth = `${containerConfig.borderWidth}px`;
          console.log('✅ Border width:', containerConfig.borderWidth);
        }
        if (containerConfig.borderColor) {
          container.style.borderColor = containerConfig.borderColor;
          console.log('✅ Border color:', containerConfig.borderColor);
        }
        
        if (containerConfig.backdropBlur !== undefined) {
          container.style.backdropFilter = `blur(${containerConfig.backdropBlur}px)`;
          console.log('✅ Backdrop blur:', containerConfig.backdropBlur);
        }
        
        if (containerConfig.backgroundOpacity !== undefined) {
          const opacity = containerConfig.backgroundOpacity / 100;
          container.style.background = `linear-gradient(135deg, rgba(30, 41, 59, ${opacity}) 0%, rgba(15, 23, 42, ${opacity * 1.25}) 100%)`;
          console.log('✅ Background opacity:', containerConfig.backgroundOpacity);
        }
        
        if (containerConfig.borderRadius !== undefined) {
          container.style.borderRadius = `${containerConfig.borderRadius}px`;
          console.log('✅ Border radius:', containerConfig.borderRadius);
        }
        
        if (containerConfig.padding !== undefined) {
          container.style.padding = `${containerConfig.padding}px`;
          console.log('✅ Container padding:', containerConfig.padding);
        }
        
        if (containerConfig.shadowIntensity !== undefined && containerConfig.shadowColor) {
          const intensity = containerConfig.shadowIntensity / 100;
          const r = parseInt(containerConfig.shadowColor.slice(1, 3), 16);
          const g = parseInt(containerConfig.shadowColor.slice(3, 5), 16);
          const b = parseInt(containerConfig.shadowColor.slice(5, 7), 16);
          const shadowOpacity = intensity * 0.6;
          container.style.boxShadow = `
            0 40px 100px rgba(${r}, ${g}, ${b}, ${shadowOpacity}),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            inset 0 -1px 0 rgba(0, 0, 0, 0.2),
            0 0 60px rgba(99, 102, 241, ${shadowOpacity * 0.3})
          `;
          console.log('✅ Shadow aplicada:', containerConfig.shadowIntensity, containerConfig.shadowColor);
        }
      }

      if (config.enablePositioning && config.design === 'grid') {
        container.classList.add('positioning-mode');
        container.style.position = 'relative';
        
        if (config.customPositions && config.customPositions.length > 0) {
          requestAnimationFrame(() => {
            config.customPositions.forEach((pos, index) => {
              if (this.boxes[index] && pos && pos.left && pos.top) {
                this.boxes[index].style.position = 'absolute';
                this.boxes[index].style.left = pos.left;
                this.boxes[index].style.top = pos.top;
                this.boxes[index].style.gridArea = 'unset';
                this.boxes[index].style.margin = '0';
                this.boxes[index].style.cursor = 'move';
              }
            });
            setTimeout(() => {
              this.initPositioningMode();
            }, 50);
          });
        } else {
          setTimeout(() => {
            this.initPositioningMode();
          }, 50);
        }
      } else {
        container.classList.remove('positioning-mode');
        if (this.positioningHandlers) {
          document.removeEventListener('mousemove', this.positioningHandlers.move);
          document.removeEventListener('mouseup', this.positioningHandlers.up);
          this.positioningHandlers = null;
        }
        this.boxes.forEach(box => {
          box.classList.remove('positionable');
          box.removeAttribute('data-positioning-listener');
          if (box.style.position === 'absolute') {
            box.style.position = '';
            box.style.left = '';
            box.style.top = '';
            box.style.gridArea = '';
            box.style.margin = '';
            box.style.cursor = '';
          }
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
        console.log('⚙️ Spin duration:', this.spinDuration);
      }
      if (layout.spin.speed) {
        this.spinSpeed = layout.spin.speed;
        console.log('⚙️ Spin speed:', this.spinSpeed);
      }
      if (layout.spin.deceleration !== undefined) {
        this.spinDeceleration = layout.spin.deceleration;
        console.log('⚙️ Spin deceleration:', this.spinDeceleration);
      }
    }
    
    if (layout.backgroundAnimation) {
      console.log('🎨 Aplicando animação de fundo:', layout.backgroundAnimation);
      this.applyBackgroundAnimation(layout.backgroundAnimation);
    } else {
      document.body.classList.remove('bg-animation-gradient', 'bg-animation-particles', 'bg-animation-waves', 'bg-animation-grid', 'bg-animation-stars', 'bg-animation-aurora', 'bg-animation-matrix', 'bg-animation-nebula');
    }
    
    console.log('✅ Layout aplicado com sucesso!', {
      roulette: layout.roulette,
      container: layout.container,
      spacing: layout.spacing,
      spin: layout.spin,
      backgroundAnimation: layout.backgroundAnimation
    });
  },
  
  applyBackgroundAnimation(config) {
    if (!config || !config.type || config.type === 'none') {
      document.body.classList.remove('bg-animation-gradient', 'bg-animation-particles', 'bg-animation-waves', 'bg-animation-grid', 'bg-animation-stars', 'bg-animation-aurora', 'bg-animation-matrix', 'bg-animation-nebula');
      const existingBg = document.getElementById('backgroundAnimation');
      if (existingBg) {
        existingBg.remove();
      }
      return;
    }
    
    document.body.classList.remove('bg-animation-gradient', 'bg-animation-particles', 'bg-animation-waves', 'bg-animation-grid', 'bg-animation-stars', 'bg-animation-aurora', 'bg-animation-matrix', 'bg-animation-nebula');
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
      const particleCount = 100;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 5 + 3;
        const delay = Math.random() * animationDuration;
        const colors = [
          'rgba(99, 102, 241, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(59, 130, 246, 0.8)'
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: radial-gradient(circle, ${color}, transparent);
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation: float ${animationDuration + Math.random() * 5}s infinite ease-in-out ${delay}s;
          box-shadow: 0 0 ${size * 3}px ${color}, 0 0 ${size * 5}px ${color};
          filter: blur(1px);
        `;
        bgElement.appendChild(particle);
      }
    } else if (config.type === 'stars' && bgElement) {
      bgElement.innerHTML = '';
      const starCount = 200;
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        const size = Math.random() * 4 + 1;
        const delay = Math.random() * animationDuration;
        const colors = ['white', 'rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.8)'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        star.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border-radius: 50%;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation: twinkle ${(animationDuration * 0.3) + Math.random() * (animationDuration * 0.3)}s infinite ${delay}s;
          box-shadow: 0 0 ${size * 4}px rgba(255, 255, 255, 0.9), 
                      0 0 ${size * 8}px rgba(255, 255, 255, 0.6),
                      0 0 ${size * 12}px rgba(255, 255, 255, 0.3);
        `;
        bgElement.appendChild(star);
      }
    } else if (config.type === 'aurora' || config.type === 'matrix' || config.type === 'nebula') {
      if (bgElement) {
        bgElement.remove();
        bgElement = null;
      }
    }
  },
  
  toggleFreePositioning() {
    this.freePositioningEnabled = !this.freePositioningEnabled;
    const container = document.querySelector('.container');
    
    if (this.freePositioningEnabled) {
      container.classList.add('positioning-mode');
      container.style.position = 'relative';
      
      if (!this.boxes || this.boxes.length === 0) {
        this.setupElements();
      }
      
      setTimeout(() => {
        this.initPositioningMode();
        console.log('✅ Modo de posicionamento livre ATIVADO!');
        console.log('📌 Agora você pode clicar e arrastar os itens para qualquer lugar.');
        console.log('💡 Dica: Clique e segure, depois arraste o item.');
      }, 100);
      
      return true;
    } else {
      container.classList.remove('positioning-mode');
      this.disablePositioningMode();
      console.log('❌ Modo de posicionamento livre DESATIVADO!');
      return false;
    }
  },

  enableFreePositioning() {
    if (!this.freePositioningEnabled) {
      return this.toggleFreePositioning();
    }
    return true;
  },

  disableFreePositioning() {
    if (this.freePositioningEnabled) {
      return this.toggleFreePositioning();
    }
    return false;
  },

  disablePositioningMode() {
    if (this.positioningHandlers) {
      document.removeEventListener('mousemove', this.positioningHandlers.move);
      document.removeEventListener('mouseup', this.positioningHandlers.up);
      this.positioningHandlers = null;
    }
    if (this.boxes) {
      this.boxes.forEach(box => {
        box.classList.remove('positionable');
        box.removeAttribute('data-positioning-listener');
        if (box._positioningMouseDown) {
          box.removeEventListener('mousedown', box._positioningMouseDown, { capture: true });
          box._positioningMouseDown = null;
        }
      });
    }
  },

  initPositioningMode() {
    const container = document.querySelector('.container');
    if ((!container.classList.contains('positioning-mode') && !this.freePositioningEnabled) || !this.boxes || this.boxes.length === 0) {
      this.disablePositioningMode();
      if (this.boxes) {
        this.boxes.forEach(box => {
          if (box.style.position === 'absolute' && !this.freePositioningEnabled) {
            box.style.position = '';
            box.style.left = '';
            box.style.top = '';
            box.style.gridArea = '';
            box.style.margin = '';
            box.style.cursor = '';
          }
        });
      }
      return;
    }

    container.style.position = 'relative';
    
    if (this.positioningHandlers) {
      document.removeEventListener('mousemove', this.positioningHandlers.move);
      document.removeEventListener('mouseup', this.positioningHandlers.up);
    }
    
    let currentDraggingBox = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartLeft = 0;
    let dragStartTop = 0;
    
    const handleMouseMove = (e) => {
      if (!currentDraggingBox || (!container.classList.contains('positioning-mode') && !this.freePositioningEnabled)) return;
      
      const containerRect = container.getBoundingClientRect();
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      let newLeft = dragStartLeft + deltaX;
      let newTop = dragStartTop + deltaY;
      
      const padding = parseInt(window.getComputedStyle(container).padding) || 0;
      const boxWidth = currentDraggingBox.offsetWidth;
      const boxHeight = currentDraggingBox.offsetHeight;
      const maxLeft = containerRect.width - boxWidth - padding;
      const maxTop = containerRect.height - boxHeight - padding;
      
      newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
      newTop = Math.max(padding, Math.min(newTop, maxTop));
      
      currentDraggingBox.style.left = newLeft + 'px';
      currentDraggingBox.style.top = newTop + 'px';
    };
    
    const handleMouseUp = () => {
      if (!currentDraggingBox) return;
      
      const box = currentDraggingBox;
      const index = Array.from(this.boxes).indexOf(box);
      
      box.style.zIndex = '';
      box.style.opacity = '';
      box.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      box.style.userSelect = '';
      box.style.cursor = 'move';
      box.classList.remove('dragging');
      
      setTimeout(() => {
        box.style.transition = '';
      }, 300);
      
      if (index !== -1 && (container.classList.contains('positioning-mode') || this.freePositioningEnabled)) {
        this.saveItemPosition(index, {
          left: box.style.left,
          top: box.style.top
        });
      }
      
      currentDraggingBox = null;
    };
    
    this.positioningHandlers = {
      move: handleMouseMove,
      up: handleMouseUp,
      currentBox: null
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    this.boxes.forEach((box, index) => {
      box.classList.add('positionable');
      box.style.cursor = 'move';
      
      if (box._positioningMouseDown) {
        box.removeEventListener('mousedown', box._positioningMouseDown);
      }
      
      const handleMouseDown = (e) => {
        const isActive = container.classList.contains('positioning-mode') || this.freePositioningEnabled;
        if (!isActive) {
          return;
        }
        
        if (box.getAttribute('draggable') === 'true' && !this.freePositioningEnabled) {
          return;
        }
        
        if (e.button !== 0) return;
        if (currentDraggingBox) return;
        if (this.spinning) return;
        
        console.log('🖱️ Iniciando arraste do item', index, 'para posicionamento livre');
        
        e.stopImmediatePropagation();
        e.preventDefault();
        e.stopPropagation();
        
        currentDraggingBox = box;
        this.positioningHandlers.currentBox = box;
        box.style.zIndex = '1000';
        box.style.opacity = '0.9';
        box.style.transition = 'none';
        box.style.userSelect = 'none';
        box.style.cursor = 'grabbing';
        box.classList.add('dragging');
        
        const rect = box.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        if (box.style.position === 'absolute' && box.style.left && box.style.top) {
          dragStartLeft = parseFloat(box.style.left);
          dragStartTop = parseFloat(box.style.top);
        } else {
          dragStartLeft = rect.left - containerRect.left;
          dragStartTop = rect.top - containerRect.top;
          box.style.position = 'absolute';
          box.style.left = dragStartLeft + 'px';
          box.style.top = dragStartTop + 'px';
          box.style.gridArea = 'unset';
          box.style.margin = '0';
        }
      };
      
      box._positioningMouseDown = handleMouseDown;
      box.addEventListener('mousedown', handleMouseDown, { capture: false, passive: false });
      box.setAttribute('data-positioning-listener', 'true');
    });
  },

  async saveItemPosition(index, position) {
    if (!this.firebaseInitialized || !this.db) return;
    
    try {
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};
      
      if (!currentLayout.roulette) {
        currentLayout.roulette = {};
      }
      
      if (!currentLayout.roulette.customPositions) {
        currentLayout.roulette.customPositions = [];
      }
      
      currentLayout.roulette.customPositions[index] = position;
      currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;
      
      await layoutRef.set(currentLayout);
    } catch (error) {
      console.error('Erro ao salvar posição:', error);
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
    
    const gridArea1 = box1.style.gridArea || window.getComputedStyle(box1).gridArea;
    const gridArea2 = box2.style.gridArea || window.getComputedStyle(box2).gridArea;
    
    if (gridArea1 && gridArea2) {
      box1.style.gridArea = gridArea2;
      box2.style.gridArea = gridArea1;
    } else {
      const areas = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10'];
      if (areas[index1] && areas[index2]) {
        box1.style.gridArea = areas[index2];
        box2.style.gridArea = areas[index1];
      }
    }
    
    const tempIndex = box1.getAttribute('data-index');
    box1.setAttribute('data-index', box2.getAttribute('data-index'));
    box2.setAttribute('data-index', tempIndex);
    
    const [box1Element, box2Element] = [this.boxes[index1], this.boxes[index2]];
    this.boxes[index1] = box2Element;
    this.boxes[index2] = box1Element;
    
    box1.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    box2.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    setTimeout(() => {
      box1.style.transition = '';
      box2.style.transition = '';
    }, 300);
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
      const container = document.querySelector('.container');
      const isPositioningMode = container && container.classList.contains('positioning-mode');
      
      if (!this.freePositioningEnabled && !isPositioningMode) {
        box.setAttribute('draggable', 'true');
        box.style.cursor = 'grab';
        
        if (box._dragStartHandler) {
          box.removeEventListener('dragstart', box._dragStartHandler);
        }
        if (box._dragEndHandler) {
          box.removeEventListener('dragend', box._dragEndHandler);
        }
        if (box._dragOverHandler) {
          box.removeEventListener('dragover', box._dragOverHandler);
        }
        if (box._dragLeaveHandler) {
          box.removeEventListener('dragleave', box._dragLeaveHandler);
        }
        if (box._dropHandler) {
          box.removeEventListener('drop', box._dropHandler);
        }
        
        const dragStartHandler = (e) => {
          if (this.freePositioningEnabled) {
            e.preventDefault();
            return false;
          }
          
          if (e.dataTransfer.files.length > 0) {
            return;
          }
          
          try {
            const dragImage = box.cloneNode(true);
            dragImage.style.opacity = '0.8';
            dragImage.style.transform = 'scale(1.1)';
            dragImage.style.width = box.offsetWidth + 'px';
            dragImage.style.height = box.offsetHeight + 'px';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            dragImage.style.pointerEvents = 'none';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, box.offsetWidth / 2, box.offsetHeight / 2);
            setTimeout(() => {
              if (dragImage.parentNode) {
                document.body.removeChild(dragImage);
              }
            }, 0);
          } catch (err) {
            console.warn('Erro ao criar drag image:', err);
          }
          
          e.dataTransfer.setData('text/plain', index.toString());
          e.dataTransfer.effectAllowed = 'move';
          box.classList.add('dragging');
          console.log('🔄 Iniciando arraste do item', index, 'para trocar');
        };
        
        const dragEndHandler = () => {
          box.classList.remove('dragging');
          this.boxes.forEach(b => b.classList.remove('drag-over'));
        };
        
        const dragOverHandler = (e) => {
          if (this.freePositioningEnabled) {
            e.preventDefault();
            return false;
          }
          
          e.preventDefault();
          if (e.dataTransfer.types.includes('text/plain')) {
            box.classList.add('drag-over');
          } else if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
          }
        };
        
        const dragLeaveHandler = () => {
          if (!this.freePositioningEnabled) {
            box.classList.remove('drag-over');
          }
        };
        
        const dropHandler = (e) => {
          if (this.freePositioningEnabled) {
            e.preventDefault();
            return false;
          }
          
          e.preventDefault();
          e.stopPropagation();
          box.classList.remove('drag-over');
          
          if (e.dataTransfer.types.includes('text/plain')) {
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(draggedIndex) && draggedIndex !== index && draggedIndex >= 0 && draggedIndex < this.boxes.length) {
              console.log('✅ Trocando item', draggedIndex, 'com item', index);
              this.swapBoxes(draggedIndex, index);
              this.trackEvent('box_swap', { from: draggedIndex, to: index });
            }
          } else if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              this.aplicarImagemEmElemento(file, box);
              this.trackEvent('image_upload', { index });
            }
          }
        };
        
        box._dragStartHandler = dragStartHandler;
        box._dragEndHandler = dragEndHandler;
        box._dragOverHandler = dragOverHandler;
        box._dragLeaveHandler = dragLeaveHandler;
        box._dropHandler = dropHandler;
        
        box.addEventListener('dragstart', dragStartHandler);
        box.addEventListener('dragend', dragEndHandler);
        box.addEventListener('dragover', dragOverHandler);
        box.addEventListener('dragleave', dragLeaveHandler);
        box.addEventListener('drop', dropHandler);
      } else {
        box.setAttribute('draggable', 'false');
        box.style.cursor = '';
      }

      let isDragging = false;
      let dragStartTime = 0;
      let dragStartPos = { x: 0, y: 0 };
      
      const handleRegularMouseDown = (e) => {
        if (isPositioningMode || this.freePositioningEnabled) {
          return;
        }
        if (this.spinning) return;
        if (e.button !== 0) return;
        
        if (box.getAttribute('draggable') === 'true') {
          return;
        }
        
        dragStartTime = Date.now();
        dragStartPos.x = e.clientX;
        dragStartPos.y = e.clientY;
        isDragging = false;
        
        e.preventDefault();
        e.stopPropagation();
      };
      
      box._regularMouseDown = handleRegularMouseDown;
      box.addEventListener('mousedown', handleRegularMouseDown, { capture: false, passive: false });

      const handleRegularMouseMove = (e) => {
        if (isPositioningMode || this.freePositioningEnabled) return;
        if (dragStartTime === 0) return;
        
        const deltaX = Math.abs(e.clientX - dragStartPos.x);
        const deltaY = Math.abs(e.clientY - dragStartPos.y);
        
        if (deltaX > 5 || deltaY > 5) {
          isDragging = true;
          if (box._clickTimer) {
            clearTimeout(box._clickTimer);
            box._clickTimer = null;
          }
        }
      };

      const handleRegularMouseUp = (e) => {
        if (isPositioningMode || this.freePositioningEnabled) return;
        
        const dragDuration = Date.now() - dragStartTime;
        const wasClick = !isDragging && dragDuration < 300;
        
        if (wasClick && !this.spinning) {
          box.classList.toggle('selected');
          this.trackEvent('image_select', { index, selected: box.classList.contains('selected') });
        }
        
        dragStartTime = 0;
        isDragging = false;
      };

      const handleRegularMouseLeave = () => {
        dragStartTime = 0;
        isDragging = false;
        if (box._clickTimer) {
          clearTimeout(box._clickTimer);
          box._clickTimer = null;
        }
      };
      
      box._regularMouseMove = handleRegularMouseMove;
      box._regularMouseUp = handleRegularMouseUp;
      box._regularMouseLeave = handleRegularMouseLeave;
      
      box.addEventListener('mousemove', handleRegularMouseMove);
      box.addEventListener('mouseup', handleRegularMouseUp);
      box.addEventListener('mouseleave', handleRegularMouseLeave);
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

    document.getElementById('generateNickPopupBtn')?.addEventListener('click', () => {
      this.generateNickPopup();
      this.trackEvent('generate_nick_popup');
    });

    document.getElementById('copyNickPopupBtn')?.addEventListener('click', () => {
      this.copyNickPopup();
      this.trackEvent('copy_nick_popup');
    });
  },

  salvarEstado() {
    const estado = [];
    this.boxes.forEach(box => {
      const bg = box.style.backgroundImage || '';
      estado.push(bg);
    });
    localStorage.setItem('only-royale-images', JSON.stringify(estado));
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
  },

  aplicarImagemEmElemento(file, elemento) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor, solte uma imagem válida.');
      return;
    }

    if (elemento === document.body) {
      console.log('⚠️ Não é possível arrastar imagens para o fundo');
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

        this.showCelebration();
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

        this.showCelebration();
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

  showCelebration() {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('celebrating');
    
    this.createConfetti();
    this.createParticles();
    
    setTimeout(() => {
      overlay.classList.remove('celebrating');
    }, 3000);
  },

  createConfetti() {
    const confettiContainer = document.querySelector('.celebration-confetti');
    if (!confettiContainer) return;
    
    confettiContainer.innerHTML = '';
    const colors = ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];
    const confettiCount = 100;
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.cssText = `
        position: absolute;
        width: ${Math.random() * 10 + 5}px;
        height: ${Math.random() * 10 + 5}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        opacity: ${Math.random() * 0.5 + 0.5};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        animation: confettiFall ${Math.random() * 3 + 2}s linear forwards;
        animation-delay: ${Math.random() * 2}s;
        transform: rotate(${Math.random() * 360}deg);
      `;
      confettiContainer.appendChild(confetti);
    }
  },

  createParticles() {
    const particlesContainer = document.querySelector('.celebration-particles');
    if (!particlesContainer) return;
    
    particlesContainer.innerHTML = '';
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'celebration-particle';
      const size = Math.random() * 6 + 3;
      const delay = Math.random() * 2;
      const duration = Math.random() * 3 + 2;
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, rgba(251, 191, 36, 0.9), rgba(251, 191, 36, 0.3));
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: particleFloat ${duration}s ease-in-out infinite;
        animation-delay: ${delay}s;
        box-shadow: 0 0 ${size * 2}px rgba(251, 191, 36, 0.6);
      `;
      particlesContainer.appendChild(particle);
    }
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
  },

  generateNickPopup() {
    const style = document.getElementById('nickStylePopup').value;
    const nick = this.getNickByStyle(style);
    const nickElement = document.getElementById('generatedNickPopup');
    const copyBtn = document.getElementById('copyNickPopupBtn');

    nickElement.textContent = nick;
    nickElement.classList.add('show');
    copyBtn.style.display = 'block';
    this.currentNick = nick;
  },

  copyNickPopup() {
    if (!this.currentNick) return;

    navigator.clipboard.writeText(this.currentNick).then(() => {
      const btn = document.getElementById('copyNickPopupBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('copied');
      }, 2000);
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

window.ativarPosicionamentoLivre = function() {
  return app.enableFreePositioning();
};

window.desativarPosicionamentoLivre = function() {
  return app.disableFreePositioning();
};

window.togglePosicionamentoLivre = function() {
  return app.toggleFreePositioning();
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    const activeElement = document.activeElement;
    const isInput = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    );
    
    if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      app.toggleFreePositioning();
    }
  }
});

console.log('%c🎯 Funções de Posicionamento Livre Disponíveis:', 'color: #10b981; font-weight: bold; font-size: 14px;');
console.log('%c• ativarPosicionamentoLivre() - Ativa o modo de posicionamento livre', 'color: #3b82f6;');
console.log('%c• desativarPosicionamentoLivre() - Desativa o modo de posicionamento livre', 'color: #3b82f6;');
console.log('%c• togglePosicionamentoLivre() - Alterna o modo de posicionamento livre', 'color: #3b82f6;');
console.log('%c• Pressione a tecla "P" para ativar/desativar rapidamente', 'color: #f59e0b;');
