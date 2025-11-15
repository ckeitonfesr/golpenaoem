const adminApp = {
  isAuthenticated: false,
  currentUser: null,
  currentSection: 'dashboard',
  db: null,
  firebaseInitialized: false,
  charts: {},
  
  defaultCredentials: {
    username: 'admin',
    password: 'admin123'
  },

  async init() {
    await this.initFirebase();
    this.checkAuth();
    this.setupEventListeners();
    this.loadSettings();
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
      } else {
        this.firebaseInitialized = false;
      }
    } catch (error) {
      this.firebaseInitialized = false;
    }
  },

  checkAuth() {
    const auth = localStorage.getItem('adminAuth');
    if (auth) {
      try {
        const authData = JSON.parse(auth);
        if (authData.authenticated && authData.expires > Date.now()) {
          this.isAuthenticated = true;
          this.currentUser = authData.username;
          this.showAdminPanel();
        } else {
          this.showLogin();
        }
      } catch (e) {
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
  },

  showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    document.getElementById('loggedUser').textContent = this.currentUser || 'Admin';
    this.showSection('dashboard');
    this.loadDashboardData();
  },

  setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('togglePassword').addEventListener('click', () => {
      const passwordInput = document.getElementById('password');
      const icon = document.getElementById('togglePassword').querySelector('i');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.logout();
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.showSection(section);
      });
    });

    document.getElementById('refreshPreview')?.addEventListener('click', () => {
      const iframe = document.getElementById('previewFrame');
      if (iframe) {
        iframe.src = 'index.html?preview=true&t=' + Date.now();
      }
    });

    document.getElementById('openPreview')?.addEventListener('click', () => {
      window.open('index.html?preview=true', '_blank');
    });


    document.getElementById('saveLayoutBtn')?.addEventListener('click', () => {
      this.saveLayout();
    });

    document.getElementById('saveRouletteBtn')?.addEventListener('click', () => {
      this.saveRouletteConfig();
    });

    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('saveAllSettingsBtn')?.addEventListener('click', () => {
      console.log('💾 Botão Salvar clicado!');
      this.saveAllSettings(false);
    });

    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => {
      const iframe = document.getElementById('settingsPreviewFrame');
      if (iframe) {
        iframe.src = 'index.html?preview=true&t=' + Date.now();
      }
    });

    document.getElementById('animationSpeed')?.addEventListener('input', (e) => {
      document.getElementById('animationSpeedValue').textContent = e.target.value;
    });

    document.getElementById('animationOpacity')?.addEventListener('input', (e) => {
      document.getElementById('animationOpacityValue').textContent = e.target.value + '%';
    });

    document.getElementById('spinSpeed')?.addEventListener('input', (e) => {
      document.getElementById('spinSpeedValue').textContent = e.target.value + 'ms';
    });

    document.getElementById('spinDuration')?.addEventListener('input', (e) => {
      document.getElementById('spinDurationValue').textContent = e.target.value + 'ms';
    });

    document.getElementById('heroTitleSize')?.addEventListener('input', (e) => {
      document.getElementById('heroTitleSizeValue').textContent = e.target.value + 'px';
    });

    document.getElementById('heroSubtitleSize')?.addEventListener('input', (e) => {
      document.getElementById('heroSubtitleSizeValue').textContent = e.target.value + 'px';
    });

    document.getElementById('rouletteBoxSize')?.addEventListener('input', (e) => {
      document.getElementById('rouletteBoxSizeValue').textContent = e.target.value + 'px';
    });

    document.getElementById('rouletteGap')?.addEventListener('input', (e) => {
      document.getElementById('rouletteGapValue').textContent = e.target.value + 'px';
    });

    document.getElementById('containerPadding')?.addEventListener('input', (e) => {
      document.getElementById('containerPaddingValue').textContent = e.target.value + 'px';
    });

    document.getElementById('heroMarginTop')?.addEventListener('input', (e) => {
      document.getElementById('heroMarginTopValue').textContent = e.target.value + 'px';
    });

    document.getElementById('heroMarginBottom')?.addEventListener('input', (e) => {
      document.getElementById('heroMarginBottomValue').textContent = e.target.value + 'px';
    });

    document.getElementById('backgroundOverlayOpacity')?.addEventListener('input', (e) => {
      document.getElementById('backgroundOverlayOpacityValue').textContent = e.target.value + '%';
    });

    document.getElementById('containerAnimationSpeed')?.addEventListener('input', (e) => {
      document.getElementById('containerAnimationSpeedValue').textContent = e.target.value;
    });

    document.getElementById('containerBorderWidth')?.addEventListener('input', (e) => {
      document.getElementById('containerBorderWidthValue').textContent = e.target.value + 'px';
    });

    document.getElementById('containerBackdropBlur')?.addEventListener('input', (e) => {
      document.getElementById('containerBackdropBlurValue').textContent = e.target.value + 'px';
    });

    document.getElementById('containerBackgroundOpacity')?.addEventListener('input', (e) => {
      document.getElementById('containerBackgroundOpacityValue').textContent = e.target.value + '%';
    });

    document.getElementById('containerBorderRadius')?.addEventListener('input', (e) => {
      document.getElementById('containerBorderRadiusValue').textContent = e.target.value + 'px';
    });

    document.getElementById('containerPaddingInner')?.addEventListener('input', (e) => {
      document.getElementById('containerPaddingInnerValue').textContent = e.target.value + 'px';
    });

    document.getElementById('containerShadowIntensity')?.addEventListener('input', (e) => {
      document.getElementById('containerShadowIntensityValue').textContent = e.target.value + '%';
    });

    document.getElementById('resetPositionsBtn')?.addEventListener('click', () => {
      this.resetPositions();
    });

    let autoSaveTimeout;
    const autoSaveHandler = () => {
      if (document.getElementById('autoSave')?.checked) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
          this.saveAllSettings(true);
        }, 500);
      }
    };

    const setupSettingsListeners = () => {
      const allInputs = document.querySelectorAll('#settingsSection input, #settingsSection select');
      console.log('📝 Configurando listeners para', allInputs.length, 'inputs');
      allInputs.forEach(input => {
        input.addEventListener('input', autoSaveHandler);
        input.addEventListener('change', autoSaveHandler);
      });
    };
    
    if (document.getElementById('settingsSection')) {
      setupSettingsListeners();
    }
    
    const originalShowSection = this.showSection.bind(this);
    this.showSection = (section) => {
      originalShowSection(section);
      if (section === 'settings') {
        setTimeout(setupSettingsListeners, 100);
      }
    };
  },

  handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    if (username === this.defaultCredentials.username && 
        password === this.defaultCredentials.password) {
      this.isAuthenticated = true;
      this.currentUser = username;
      
      const authData = {
        authenticated: true,
        username: username,
        expires: Date.now() + (24 * 60 * 60 * 1000)
      };
      localStorage.setItem('adminAuth', JSON.stringify(authData));

      errorDiv.classList.remove('show');
      this.showAdminPanel();
      this.addActivity('Login realizado com sucesso');
      
      if (this.firebaseInitialized && this.db) {
        this.db.ref('admin_logs').push({
          username: username,
          action: 'login',
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
      }
    } else {
      errorDiv.textContent = 'Usuário ou senha incorretos!';
      errorDiv.classList.add('show');
    }
  },

  logout() {
    localStorage.removeItem('adminAuth');
    this.isAuthenticated = false;
    this.currentUser = null;
    this.showLogin();
    document.getElementById('loginForm').reset();
  },

  showSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.section === section) {
        item.classList.add('active');
      }
    });

    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
      sectionElement.classList.add('active');
    }

    const titles = {
      dashboard: { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
      preview: { title: 'Pré-visualização', subtitle: 'Visualize o site em tempo real' },
      analytics: { title: 'Analytics', subtitle: 'Análise detalhada de dados' },
      devices: { title: 'Dispositivos', subtitle: 'Dispositivos conectados' },
      settings: { title: 'Configurações', subtitle: 'Configure o sistema' }
    };

    if (titles[section]) {
      document.getElementById('pageTitle').textContent = titles[section].title;
      document.getElementById('pageSubtitle').textContent = titles[section].subtitle;
    }

    this.currentSection = section;

    if (section === 'preview') {
      const iframe = document.getElementById('previewFrame');
      if (iframe) {
        iframe.src = 'index.html?preview=true';
      }
    } else if (section === 'analytics') {
      this.loadAnalytics();
    } else if (section === 'devices') {
      this.loadDevices();
    } else if (section === 'settings') {
      setTimeout(() => {
        console.log('⚙️ Carregando configurações...');
        this.loadRouletteConfig();
        const settingsIframe = document.getElementById('settingsPreviewFrame');
        if (settingsIframe) {
          settingsIframe.src = 'index.html?preview=true';
        }
      }, 200);
    }
  },

  async loadDashboardData() {
    if (!this.firebaseInitialized || !this.db) {
      this.updateStats({ newDevices: 0, totalVisits: 0, todayVisits: 0 });
      this.loadRecentActivitiesLocal();
      return;
    }

    try {
      const newDevicesRef = this.db.ref('analytics/newDevices');
      const devicesRef = this.db.ref('devices');
      
      const [newDevicesSnapshot, devicesSnapshot] = await Promise.all([
        newDevicesRef.once('value'),
        devicesRef.once('value')
      ]);

      const newDevicesData = newDevicesSnapshot.val() || {};
      const devicesData = devicesSnapshot.val() || {};

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      let totalDevices = 0;
      let todayVisits = 0;
      
      if (devicesData) {
        const uniqueDevices = new Set();
        const todayDevices = new Set();
        
        Object.values(devicesData).forEach(device => {
          if (device && device.deviceId) {
            uniqueDevices.add(device.deviceId);
            
            if (device.lastAccess && device.lastAccess >= todayTimestamp) {
              todayDevices.add(device.deviceId);
            }
          }
        });
        
        totalDevices = uniqueDevices.size;
        todayVisits = todayDevices.size;
      }

      const stats = {
        newDevices: newDevicesData.count || 0,
        totalVisits: totalDevices,
        todayVisits: todayVisits
      };

      this.updateStats(stats);
      this.loadRecentActivities();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  },

  updateStats(stats) {
    document.getElementById('newDevices').textContent = stats.newDevices || 0;
    document.getElementById('totalVisits').textContent = stats.totalVisits || 0;
    document.getElementById('todayVisits').textContent = stats.todayVisits || 0;
  },

  loadRecentActivitiesLocal() {
    const activitiesList = document.getElementById('recentActivities');
    if (!activitiesList) return;

    const localEvents = JSON.parse(localStorage.getItem('localEvents') || '[]');
    activitiesList.innerHTML = '';

    if (localEvents.length === 0) {
      activitiesList.innerHTML = '<p style="color: var(--gray-500); text-align: center;">Nenhuma atividade recente (modo local)</p>';
      return;
    }

    localEvents.slice(-10).reverse().forEach(event => {
      const activityItem = document.createElement('div');
      activityItem.className = 'activity-item';
      activityItem.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
          <p>${this.formatEventName(event.eventName || 'Ação')}</p>
          <span>${this.formatTimestamp({ toDate: () => new Date(event.timestamp) })}</span>
        </div>
      `;
      activitiesList.appendChild(activityItem);
    });
  },


  async loadRecentActivities() {
    if (!this.firebaseInitialized || !this.db) {
      this.loadRecentActivitiesLocal();
      return;
    }

    try {
      const logsRef = this.db.ref('admin_logs');
      const snapshot = await logsRef.limitToLast(10).once('value');
      
      const activitiesList = document.getElementById('recentActivities');
      activitiesList.innerHTML = '';

      if (!snapshot.exists()) {
        activitiesList.innerHTML = '<p style="color: var(--gray-500); text-align: center;">Nenhuma atividade recente</p>';
        return;
      }

      const activities = [];
      snapshot.forEach(child => {
        const data = child.val();
        if (data && data.timestamp) {
          activities.push({ ...data, key: child.key });
        }
      });

      activities.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
        return timeB - timeA;
      });

      activities.slice(0, 10).forEach(data => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
          <i class="fas fa-check-circle"></i>
          <div>
            <p>${data.action || 'Ação'} - ${data.username || 'Sistema'}</p>
            <span>${this.formatTimestamp(data.timestamp)}</span>
          </div>
        `;
        activitiesList.appendChild(activityItem);
      });
    } catch (error) {
      this.firebaseInitialized = false;
      this.loadRecentActivitiesLocal();
    }
  },


  formatEventName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  formatTimestamp(timestamp) {
    if (!timestamp) return 'Agora';
    let date;
    if (typeof timestamp === 'object' && timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  },

  addActivity(message) {
    const activitiesList = document.getElementById('recentActivities');
    if (!activitiesList) return;
    
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <div>
        <p>${message}</p>
        <span>Agora</span>
      </div>
    `;
    activitiesList.insertBefore(activityItem, activitiesList.firstChild);
    
    while (activitiesList.children.length > 10) {
      activitiesList.removeChild(activitiesList.lastChild);
    }
  },

  async saveLayout() {
    if (!this.firebaseInitialized || !this.db) {
      const backgroundColor = document.getElementById('backgroundColor').value;
      const layout = { backgroundColor };
      localStorage.setItem('localLayout', JSON.stringify(layout));
      this.addActivity('Layout salvo localmente (Firebase não configurado)');
      alert('Layout salvo localmente! Configure o Firebase para sincronização em tempo real.');
      return;
    }

    try {
      const backgroundColor = document.getElementById('backgroundColor').value;

      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};

      currentLayout.backgroundColor = backgroundColor;
      currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;

      await layoutRef.set(currentLayout);
      this.addActivity('Layout salvo com sucesso');
      alert('Layout salvo! As mudanças serão aplicadas no site em tempo real.');
    } catch (error) {
      console.error('Erro ao salvar layout:', error);
      alert('Erro ao salvar layout');
    }
  },

  async saveRouletteConfig() {
    if (!this.firebaseInitialized || !this.db) {
      alert('Firebase não configurado. Configure o Firebase para salvar as configurações.');
      return;
    }

    try {
      const design = document.getElementById('rouletteDesign').value;
      const animation = document.getElementById('rouletteAnimation').value;
      const boxSize = parseInt(document.getElementById('rouletteBoxSize').value);
      const containerWidth = document.getElementById('rouletteContainerWidth').value;
      const enableDragDrop = document.getElementById('enableDragDrop').checked;

      const rouletteConfig = {
        design: design,
        animation: animation === 'none' ? null : animation,
        boxSize: boxSize,
        containerWidth: containerWidth,
        enableDragDrop: enableDragDrop
      };

      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};

      currentLayout.roulette = rouletteConfig;
      currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;

      await layoutRef.set(currentLayout);
      this.addActivity('Configuração da roleta salva com sucesso');
      alert('Configuração da roleta salva! As mudanças serão aplicadas no site em tempo real.');
    } catch (error) {
      console.error('Erro ao salvar configuração da roleta:', error);
      alert('Erro ao salvar configuração da roleta');
    }
  },

  async saveAllSettings(silent = false) {
    console.log('🔍 Verificando Firebase...', {
      firebaseInitialized: this.firebaseInitialized,
      db: !!this.db,
      windowDb: !!window.db
    });
    
    if (!this.firebaseInitialized || !this.db) {
      if (!silent) {
        alert('Firebase não configurado. Configure o Firebase para salvar as configurações.');
      }
      console.error('❌ Firebase não inicializado! Verifique firebase-config.js');
      return;
    }

    try {
      console.log('💾 Iniciando salvamento de configurações...');
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};
      
      console.log('📋 Layout atual do Firebase:', currentLayout);

      const bgColorEl = document.getElementById('backgroundColor');
      const bgColorSecEl = document.getElementById('backgroundColorSecondary');
      const btnColorEl = document.getElementById('buttonColor');
      const btnHoverEl = document.getElementById('buttonHoverColor');
      const accentEl = document.getElementById('accentColor');
      
      if (bgColorEl) currentLayout.backgroundColor = bgColorEl.value;
      if (bgColorSecEl) currentLayout.backgroundColorSecondary = bgColorSecEl.value;
      if (btnColorEl) currentLayout.buttonColor = btnColorEl.value;
      if (btnHoverEl) currentLayout.buttonHoverColor = btnHoverEl.value;
      if (accentEl) currentLayout.accentColor = accentEl.value;

      const heroTitleEl = document.getElementById('heroTitle');
      const heroSubtitleEl = document.getElementById('heroSubtitle');
      const heroTitleSizeEl = document.getElementById('heroTitleSize');
      const heroSubtitleSizeEl = document.getElementById('heroSubtitleSize');
      const heroTitleColorEl = document.getElementById('heroTitleColor');
      const heroSubtitleColorEl = document.getElementById('heroSubtitleColor');
      
      if (heroTitleEl) currentLayout.heroTitle = heroTitleEl.value;
      if (heroSubtitleEl) currentLayout.heroSubtitle = heroSubtitleEl.value;
      if (heroTitleSizeEl) currentLayout.heroTitleSize = parseInt(heroTitleSizeEl.value) || 48;
      if (heroSubtitleSizeEl) currentLayout.heroSubtitleSize = parseInt(heroSubtitleSizeEl.value) || 20;
      if (heroTitleColorEl) currentLayout.heroTitleColor = heroTitleColorEl.value;
      if (heroSubtitleColorEl) currentLayout.heroSubtitleColor = heroSubtitleColorEl.value;

      const rouletteDesignEl = document.getElementById('rouletteDesign');
      const rouletteAnimationEl = document.getElementById('rouletteAnimation');
      const rouletteBoxSizeEl = document.getElementById('rouletteBoxSize');
      const rouletteContainerWidthEl = document.getElementById('rouletteContainerWidth');
      const rouletteGapEl = document.getElementById('rouletteGap');
      const enableDragDropEl = document.getElementById('enableDragDrop');
      const enablePositioningEl = document.getElementById('enablePositioning');
      
      currentLayout.roulette = {
        design: rouletteDesignEl ? rouletteDesignEl.value : 'grid',
        animation: rouletteAnimationEl && rouletteAnimationEl.value !== 'none' ? rouletteAnimationEl.value : null,
        boxSize: rouletteBoxSizeEl ? parseInt(rouletteBoxSizeEl.value) || 180 : 180,
        containerWidth: rouletteContainerWidthEl ? rouletteContainerWidthEl.value : 'auto',
        gap: rouletteGapEl ? parseInt(rouletteGapEl.value) || 32 : 32,
        enableDragDrop: enableDragDropEl ? enableDragDropEl.checked === true : false,
        enablePositioning: enablePositioningEl ? enablePositioningEl.checked === true : false
      };

      const bgAnimationEl = document.getElementById('backgroundAnimation');
      const animationSpeedEl = document.getElementById('animationSpeed');
      const animationOpacityEl = document.getElementById('animationOpacity');
      
      currentLayout.backgroundAnimation = {
        type: bgAnimationEl ? bgAnimationEl.value : 'none',
        speed: animationSpeedEl ? parseInt(animationSpeedEl.value) || 5 : 5,
        opacity: animationOpacityEl ? parseInt(animationOpacityEl.value) || 30 : 30
      };

      const bgImageUrlEl = document.getElementById('backgroundImageUrl');
      const bgVideoUrlEl = document.getElementById('backgroundVideoUrl');
      const bgVideoLoopEl = document.getElementById('backgroundVideoLoop');
      const bgVideoAutoplayEl = document.getElementById('backgroundVideoAutoplay');
      const bgOverlayOpacityEl = document.getElementById('backgroundOverlayOpacity');
      
      currentLayout.backgroundMedia = {
        imageUrl: bgImageUrlEl ? bgImageUrlEl.value || '' : '',
        videoUrl: bgVideoUrlEl ? bgVideoUrlEl.value || '' : '',
        videoLoop: bgVideoLoopEl ? bgVideoLoopEl.checked === true : false,
        videoAutoplay: bgVideoAutoplayEl ? bgVideoAutoplayEl.checked === true : false,
        overlayOpacity: bgOverlayOpacityEl ? parseInt(bgOverlayOpacityEl.value) || 50 : 50
      };

      const spinDurationEl = document.getElementById('spinDuration');
      const spinSpeedEl = document.getElementById('spinSpeed');
      const spinDecelerationEl = document.getElementById('spinDeceleration');
      
      currentLayout.spin = {
        duration: spinDurationEl ? parseInt(spinDurationEl.value) || 5000 : 5000,
        speed: spinSpeedEl ? parseInt(spinSpeedEl.value) || 100 : 100,
        deceleration: spinDecelerationEl ? spinDecelerationEl.checked === true : false
      };

      const containerPaddingEl = document.getElementById('containerPadding');
      const heroMarginTopEl = document.getElementById('heroMarginTop');
      const heroMarginBottomEl = document.getElementById('heroMarginBottom');
      
      currentLayout.spacing = {
        containerPadding: containerPaddingEl ? parseInt(containerPaddingEl.value) : 64,
        heroMarginTop: heroMarginTopEl ? parseInt(heroMarginTopEl.value) : 0,
        heroMarginBottom: heroMarginBottomEl ? parseInt(heroMarginBottomEl.value) : 0
      };
      
      console.log('📏 Espaçamentos:', currentLayout.spacing);

      currentLayout.container = {
        animation: document.getElementById('containerAnimation')?.value || 'none',
        animationSpeed: parseInt(document.getElementById('containerAnimationSpeed')?.value || 5),
        borderWidth: parseInt(document.getElementById('containerBorderWidth')?.value || 2),
        borderColor: document.getElementById('containerBorderColor')?.value || '#6366f1',
        backdropBlur: parseInt(document.getElementById('containerBackdropBlur')?.value || 50),
        backgroundOpacity: parseInt(document.getElementById('containerBackgroundOpacity')?.value || 40),
        borderRadius: parseInt(document.getElementById('containerBorderRadius')?.value || 32),
        padding: parseInt(document.getElementById('containerPaddingInner')?.value || 64),
        shadowIntensity: parseInt(document.getElementById('containerShadowIntensity')?.value || 60),
        shadowColor: document.getElementById('containerShadowColor')?.value || '#000000'
      };

      currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;

      console.log('💾 Salvando no Firebase:', JSON.stringify(currentLayout, null, 2));
      
      try {
        await layoutRef.set(currentLayout);
        console.log('✅ Configurações salvas com sucesso no Firebase');
        
        const verifySnapshot = await layoutRef.once('value');
        if (verifySnapshot.exists()) {
          const savedData = verifySnapshot.val();
          console.log('✅ Verificação: Dados confirmados no Firebase', savedData);
        } else {
          console.error('❌ Erro: Dados não foram salvos no Firebase');
        }
        
        if (!silent) {
          this.addActivity('Todas as configurações salvas com sucesso');
          alert('✅ Configurações salvas! As mudanças serão aplicadas no site em tempo real.');
        } else {
          this.addActivity('Configurações atualizadas automaticamente');
        }
      } catch (saveError) {
        console.error('❌ Erro ao salvar no Firebase:', saveError);
        throw saveError;
      }
    } catch (error) {
      console.error('❌ Erro ao salvar configurações:', error);
      if (!silent) {
        alert('❌ Erro ao salvar configurações: ' + (error.message || error));
      }
    }
  },

  async loadRouletteConfig() {
    const allCheckboxes = [
      'enableDragDrop',
      'enablePositioning',
      'autoSave',
      'backgroundVideoLoop',
      'backgroundVideoAutoplay',
      'spinDeceleration'
    ];
    
    allCheckboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = false; // Forçar desmarcado inicialmente
      }
    });

    if (!this.firebaseInitialized || !this.db) {
      console.log('⚠️ Firebase não inicializado, usando valores padrão');
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      
      if (snapshot.exists()) {
        const layout = snapshot.val();
        console.log('✅ Carregando configurações do Firebase:', layout);
        
        if (layout.backgroundColor) {
          document.getElementById('backgroundColor').value = layout.backgroundColor;
        }
        if (layout.backgroundColorSecondary) {
          document.getElementById('backgroundColorSecondary').value = layout.backgroundColorSecondary;
        }
        if (layout.buttonColor) {
          document.getElementById('buttonColor').value = layout.buttonColor;
        }
        if (layout.buttonHoverColor) {
          document.getElementById('buttonHoverColor').value = layout.buttonHoverColor;
        }
        if (layout.accentColor) {
          document.getElementById('accentColor').value = layout.accentColor;
        }

        if (layout.heroTitle) {
          document.getElementById('heroTitle').value = layout.heroTitle;
        }
        if (layout.heroSubtitle) {
          document.getElementById('heroSubtitle').value = layout.heroSubtitle;
        }
        if (layout.heroTitleSize) {
          const titleSizeEl = document.getElementById('heroTitleSize');
          const titleSizeValueEl = document.getElementById('heroTitleSizeValue');
          if (titleSizeEl) titleSizeEl.value = layout.heroTitleSize;
          if (titleSizeValueEl) titleSizeValueEl.textContent = layout.heroTitleSize + 'px';
        }
        if (layout.heroSubtitleSize) {
          const subtitleSizeEl = document.getElementById('heroSubtitleSize');
          const subtitleSizeValueEl = document.getElementById('heroSubtitleSizeValue');
          if (subtitleSizeEl) subtitleSizeEl.value = layout.heroSubtitleSize;
          if (subtitleSizeValueEl) subtitleSizeValueEl.textContent = layout.heroSubtitleSize + 'px';
        }
        if (layout.heroTitleColor) {
          document.getElementById('heroTitleColor').value = layout.heroTitleColor;
        }
        if (layout.heroSubtitleColor) {
          document.getElementById('heroSubtitleColor').value = layout.heroSubtitleColor;
        }
        
        if (layout.roulette) {
          const config = layout.roulette;
          
          if (config.design) {
            document.getElementById('rouletteDesign').value = config.design;
          }
          
          if (config.animation) {
            document.getElementById('rouletteAnimation').value = config.animation;
          } else {
            document.getElementById('rouletteAnimation').value = 'none';
          }
          
          if (config.boxSize) {
            const boxSizeEl = document.getElementById('rouletteBoxSize');
            const boxSizeValueEl = document.getElementById('rouletteBoxSizeValue');
            if (boxSizeEl) boxSizeEl.value = config.boxSize;
            if (boxSizeValueEl) boxSizeValueEl.textContent = config.boxSize + 'px';
          }
          
          if (config.containerWidth) {
            document.getElementById('rouletteContainerWidth').value = config.containerWidth;
          }

          if (config.gap !== undefined) {
            const gapEl = document.getElementById('rouletteGap');
            const gapValueEl = document.getElementById('rouletteGapValue');
            if (gapEl) gapEl.value = config.gap;
            if (gapValueEl) gapValueEl.textContent = config.gap + 'px';
          }
          
          const enableDragDropEl = document.getElementById('enableDragDrop');
          if (enableDragDropEl) {
            if (config.enableDragDrop === true) {
              enableDragDropEl.checked = true;
            } else {
              enableDragDropEl.checked = false; // Padrão: desativado
            }
          }

          const enablePositioningEl = document.getElementById('enablePositioning');
          if (enablePositioningEl) {
            if (config.enablePositioning === true) {
              enablePositioningEl.checked = true;
            } else {
              enablePositioningEl.checked = false; // Padrão: desativado
            }
          }
        }

        if (layout.backgroundAnimation) {
          if (layout.backgroundAnimation.type) {
            document.getElementById('backgroundAnimation').value = layout.backgroundAnimation.type;
          }
          if (layout.backgroundAnimation.speed) {
            document.getElementById('animationSpeed').value = layout.backgroundAnimation.speed;
            document.getElementById('animationSpeedValue').textContent = layout.backgroundAnimation.speed;
          }
          if (layout.backgroundAnimation.opacity !== undefined) {
            document.getElementById('animationOpacity').value = layout.backgroundAnimation.opacity;
            document.getElementById('animationOpacityValue').textContent = layout.backgroundAnimation.opacity + '%';
          }
        }

        if (layout.backgroundMedia) {
          if (layout.backgroundMedia.imageUrl) {
            const imageUrlEl = document.getElementById('backgroundImageUrl');
            if (imageUrlEl) imageUrlEl.value = layout.backgroundMedia.imageUrl;
          }
          if (layout.backgroundMedia.videoUrl) {
            const videoUrlEl = document.getElementById('backgroundVideoUrl');
            if (videoUrlEl) videoUrlEl.value = layout.backgroundMedia.videoUrl;
          }
          const videoLoopEl = document.getElementById('backgroundVideoLoop');
          if (videoLoopEl) {
            if (layout.backgroundMedia.videoLoop === true) {
              videoLoopEl.checked = true;
            } else {
              videoLoopEl.checked = false; // Padrão: desativado
            }
          }
          
          const videoAutoplayEl = document.getElementById('backgroundVideoAutoplay');
          if (videoAutoplayEl) {
            if (layout.backgroundMedia.videoAutoplay === true) {
              videoAutoplayEl.checked = true;
            } else {
              videoAutoplayEl.checked = false; // Padrão: desativado
            }
          }
          if (layout.backgroundMedia.overlayOpacity !== undefined) {
            const overlayOpacityEl = document.getElementById('backgroundOverlayOpacity');
            const overlayOpacityValueEl = document.getElementById('backgroundOverlayOpacityValue');
            if (overlayOpacityEl) overlayOpacityEl.value = layout.backgroundMedia.overlayOpacity;
            if (overlayOpacityValueEl) overlayOpacityValueEl.textContent = layout.backgroundMedia.overlayOpacity + '%';
          }
        }

        if (layout.spin) {
          if (layout.spin.duration) {
            const spinDurationEl = document.getElementById('spinDuration');
            const spinDurationValueEl = document.getElementById('spinDurationValue');
            if (spinDurationEl) spinDurationEl.value = layout.spin.duration;
            if (spinDurationValueEl) spinDurationValueEl.textContent = layout.spin.duration + 'ms';
          }
          if (layout.spin.speed) {
            const spinSpeedEl = document.getElementById('spinSpeed');
            const spinSpeedValueEl = document.getElementById('spinSpeedValue');
            if (spinSpeedEl) spinSpeedEl.value = layout.spin.speed;
            if (spinSpeedValueEl) spinSpeedValueEl.textContent = layout.spin.speed + 'ms';
          }
          const spinDecelerationEl = document.getElementById('spinDeceleration');
          if (spinDecelerationEl) {
            if (layout.spin.deceleration === true) {
              spinDecelerationEl.checked = true;
            } else {
              spinDecelerationEl.checked = false; // Padrão: desativado
            }
          }
        }

        if (layout.spacing) {
          if (layout.spacing.containerPadding !== undefined) {
            const paddingEl = document.getElementById('containerPadding');
            const paddingValueEl = document.getElementById('containerPaddingValue');
            if (paddingEl) paddingEl.value = layout.spacing.containerPadding;
            if (paddingValueEl) paddingValueEl.textContent = layout.spacing.containerPadding + 'px';
          }
          if (layout.spacing.heroMarginTop !== undefined) {
            const marginTopEl = document.getElementById('heroMarginTop');
            const marginTopValueEl = document.getElementById('heroMarginTopValue');
            if (marginTopEl) marginTopEl.value = layout.spacing.heroMarginTop;
            if (marginTopValueEl) marginTopValueEl.textContent = layout.spacing.heroMarginTop + 'px';
          }
          if (layout.spacing.heroMarginBottom !== undefined) {
            const marginBottomEl = document.getElementById('heroMarginBottom');
            const marginBottomValueEl = document.getElementById('heroMarginBottomValue');
            if (marginBottomEl) marginBottomEl.value = layout.spacing.heroMarginBottom;
            if (marginBottomValueEl) marginBottomValueEl.textContent = layout.spacing.heroMarginBottom + 'px';
          }
        }

        if (layout.container) {
          const container = layout.container;
          
          if (container.animation) {
            const animEl = document.getElementById('containerAnimation');
            if (animEl) animEl.value = container.animation;
          }
          
          if (container.animationSpeed !== undefined) {
            const speedEl = document.getElementById('containerAnimationSpeed');
            const speedValueEl = document.getElementById('containerAnimationSpeedValue');
            if (speedEl) speedEl.value = container.animationSpeed;
            if (speedValueEl) speedValueEl.textContent = container.animationSpeed;
          }
          
          if (container.borderWidth !== undefined) {
            const borderWidthEl = document.getElementById('containerBorderWidth');
            const borderWidthValueEl = document.getElementById('containerBorderWidthValue');
            if (borderWidthEl) borderWidthEl.value = container.borderWidth;
            if (borderWidthValueEl) borderWidthValueEl.textContent = container.borderWidth + 'px';
          }
          
          if (container.borderColor) {
            const borderColorEl = document.getElementById('containerBorderColor');
            if (borderColorEl) borderColorEl.value = container.borderColor;
          }
          
          if (container.backdropBlur !== undefined) {
            const blurEl = document.getElementById('containerBackdropBlur');
            const blurValueEl = document.getElementById('containerBackdropBlurValue');
            if (blurEl) blurEl.value = container.backdropBlur;
            if (blurValueEl) blurValueEl.textContent = container.backdropBlur + 'px';
          }
          
          if (container.backgroundOpacity !== undefined) {
            const opacityEl = document.getElementById('containerBackgroundOpacity');
            const opacityValueEl = document.getElementById('containerBackgroundOpacityValue');
            if (opacityEl) opacityEl.value = container.backgroundOpacity;
            if (opacityValueEl) opacityValueEl.textContent = container.backgroundOpacity + '%';
          }
          
          if (container.borderRadius !== undefined) {
            const radiusEl = document.getElementById('containerBorderRadius');
            const radiusValueEl = document.getElementById('containerBorderRadiusValue');
            if (radiusEl) radiusEl.value = container.borderRadius;
            if (radiusValueEl) radiusValueEl.textContent = container.borderRadius + 'px';
          }
          
          if (container.padding !== undefined) {
            const paddingEl = document.getElementById('containerPaddingInner');
            const paddingValueEl = document.getElementById('containerPaddingInnerValue');
            if (paddingEl) paddingEl.value = container.padding;
            if (paddingValueEl) paddingValueEl.textContent = container.padding + 'px';
          }
          
          if (container.shadowIntensity !== undefined) {
            const shadowIntensityEl = document.getElementById('containerShadowIntensity');
            const shadowIntensityValueEl = document.getElementById('containerShadowIntensityValue');
            if (shadowIntensityEl) shadowIntensityEl.value = container.shadowIntensity;
            if (shadowIntensityValueEl) shadowIntensityValueEl.textContent = container.shadowIntensity + '%';
          }
          
          if (container.shadowColor) {
            const shadowColorEl = document.getElementById('containerShadowColor');
            if (shadowColorEl) shadowColorEl.value = container.shadowColor;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  },

  async loadSettings() {
    const allCheckboxes = [
      'enableDragDrop',
      'enablePositioning',
      'autoSave',
      'backgroundVideoLoop',
      'backgroundVideoAutoplay',
      'spinDeceleration'
    ];
    
    allCheckboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = false; // Forçar desmarcado inicialmente
      }
    });
    
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    
    const autoSave = document.getElementById('autoSave');
    if (autoSave) {
      if (settings.autoSave === true) {
        autoSave.checked = true;
      } else {
        autoSave.checked = false; // Padrão: desativado
      }
    }
    
    if (settings.spinDuration) {
      const spinDuration = document.getElementById('spinDuration');
      if (spinDuration) spinDuration.value = settings.spinDuration;
    }
    
    await this.loadRouletteConfig();
  },

  async resetPositions() {
    if (!this.firebaseInitialized || !this.db) {
      alert('Firebase não configurado.');
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};

      if (currentLayout.roulette) {
        delete currentLayout.roulette.positions;
        delete currentLayout.roulette.customPositions;
        currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;
        await layoutRef.set(currentLayout);
        this.addActivity('Posições resetadas com sucesso');
        alert('Posições resetadas! O layout voltou ao padrão.');
      }
    } catch (error) {
      console.error('Erro ao resetar posições:', error);
      alert('Erro ao resetar posições');
    }
  },

  saveSettings() {
    const settings = {
      autoSave: document.getElementById('autoSave')?.checked || false,
      spinDuration: parseInt(document.getElementById('spinDuration')?.value || 5000)
    };

    localStorage.setItem('adminSettings', JSON.stringify(settings));
    this.addActivity('Configurações salvas com sucesso');
    alert('Configurações salvas!');
  },



  async loadDevices() {
    if (!this.firebaseInitialized || !this.db) {
      const tbody = document.getElementById('devicesTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--gray-500);">Firebase não configurado. Configure as credenciais para ver dispositivos.</td></tr>';
      }
      return;
    }

    try {
      const devicesRef = this.db.ref('devices');
      const snapshot = await devicesRef.limitToLast(100).once('value');

      const tbody = document.getElementById('devicesTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!snapshot.exists()) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--gray-500);">Nenhum dispositivo registrado</td></tr>';
        return;
      }

      const devices = [];
      snapshot.forEach(child => {
        const data = child.val();
        if (data) {
          devices.push({ id: child.key, ...data });
        }
      });

      devices.sort((a, b) => {
        const timeA = typeof a.lastAccess === 'number' ? a.lastAccess : 0;
        const timeB = typeof b.lastAccess === 'number' ? b.lastAccess : 0;
        return timeB - timeA;
      });

      devices.slice(0, 100).forEach(device => {
        const data = device;
        const ipLocation = data.ipLocation;
        
        let locationText = 'N/A';
        if (ipLocation) {
          const parts = [];
          if (ipLocation.city) parts.push(ipLocation.city);
          if (ipLocation.region) parts.push(ipLocation.region);
          if (ipLocation.country) parts.push(ipLocation.country);
          locationText = parts.length > 0 ? parts.join(', ') : 'Localizado';
        } else if (data.ip && data.ip !== 'Desconhecido') {
          locationText = 'Carregando...';
        }
        
        const hasLocation = ipLocation && ipLocation.latitude && ipLocation.longitude;
        const latitude = hasLocation ? ipLocation.latitude : null;
        const longitude = hasLocation ? ipLocation.longitude : null;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data.deviceId ? data.deviceId.substring(0, 12) + '...' : 'N/A'}</td>
          <td>${data.deviceName || 'N/A'}</td>
          <td>${data.ip || 'N/A'}</td>
          <td>${locationText}</td>
          <td>${this.formatTimestamp(data.lastAccess)}</td>
          <td>${data.isNew ? '<span style="color: var(--accent); font-weight: 600;">Sim</span>' : 'Não'}</td>
          <td>
            ${hasLocation ? `
              <button class="btn-icon" onclick="adminApp.openLocationInMaps(${latitude}, ${longitude}, '${device.id}')" title="Abrir no Google Maps" style="background: #10b981;">
                <i class="fas fa-map-marker-alt"></i>
              </button>
            ` : ''}
          </td>
        `;
        tbody.appendChild(row);
      });
    } catch (error) {
      this.firebaseInitialized = false;
      const tbody = document.getElementById('devicesTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--gray-500);">Erro ao carregar dispositivos. Configure o Firebase.</td></tr>';
      }
    }
  },


  openLocationInMaps(latitude, longitude, deviceId) {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}&z=15`;
    window.open(url, '_blank');
    
    this.addActivity(`Localização do dispositivo ${deviceId?.substring(0, 12)} aberta no Google Maps`);
  },

  async loadAnalytics() {
    if (!this.firebaseInitialized || !this.db) {
      const canvas = document.getElementById('itemsChart');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Firebase não configurado', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    try {
      const [itemsRef, devicesRef] = await Promise.all([
        this.db.ref('analytics/selectedItems').once('value'),
        this.db.ref('devices').once('value')
      ]);

      const itemsSnapshot = itemsRef;
      const devicesSnapshot = devicesRef;

      const selectedItems = {};
      if (itemsSnapshot.exists()) {
        itemsSnapshot.forEach(child => {
          const index = parseInt(child.key);
          const count = child.val() || 0;
          if (!isNaN(index)) {
            selectedItems[index] = count;
          }
        });
      }

      const itemsArray = [];
      for (let i = 0; i < 10; i++) {
        itemsArray.push({
          index: i,
          label: `Item ${i + 1}`,
          count: selectedItems[i] || 0
        });
      }

      itemsArray.sort((a, b) => b.count - a.count);

      const itemsCanvas = document.getElementById('itemsChart');
      if (itemsCanvas) {
        const itemsCtx = itemsCanvas.getContext('2d');

        if (this.charts.items) {
          this.charts.items.destroy();
        }

        this.charts.items = new Chart(itemsCtx, {
          type: 'bar',
          data: {
            labels: itemsArray.map(item => item.label),
            datasets: [{
              label: 'Vezes Selecionado',
              data: itemsArray.map(item => item.count),
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderColor: 'rgba(16, 185, 129, 1)',
              borderWidth: 2,
              borderRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: '#e2e8f0',
                  font: {
                    family: 'Inter',
                    size: 12
                  }
                }
              },
              title: {
                display: true,
                text: 'Itens Mais Selecionados',
                color: '#e2e8f0',
                font: {
                  family: 'Inter',
                  size: 16,
                  weight: 'bold'
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: '#94a3b8',
                  font: {
                    family: 'Inter'
                  },
                  stepSize: 1
                },
                grid: {
                  color: 'rgba(100, 116, 139, 0.2)'
                }
              },
              x: {
                ticks: {
                  color: '#94a3b8',
                  font: {
                    family: 'Inter'
                  }
                },
                grid: {
                  color: 'rgba(100, 116, 139, 0.2)'
                }
              }
            }
          }
        });
      }

      const devices = [];
      if (devicesSnapshot.exists()) {
        devicesSnapshot.forEach(child => {
          const data = child.val();
          if (data) {
            devices.push(data);
          }
        });
      }

      const deviceTypes = {
        PC: 0,
        Mobile: 0
      };

      devices.forEach(device => {
        const platform = (device.platform || '').toLowerCase();
        const deviceName = (device.deviceName || '').toLowerCase();
        
        if (platform.includes('win') || 
            platform.includes('mac') || 
            platform.includes('linux') ||
            deviceName.includes('windows') ||
            deviceName.includes('pc') ||
            deviceName.includes('mac')) {
          deviceTypes.PC++;
        } else if (platform.includes('android') ||
                   platform.includes('iphone') ||
                   platform.includes('ipad') ||
                   deviceName.includes('android') ||
                   deviceName.includes('iphone') ||
                   deviceName.includes('mobile') ||
                   deviceName.includes('smartphone')) {
          deviceTypes.Mobile++;
        } else {
          deviceTypes.PC++;
        }
      });

      const platformsCanvas = document.getElementById('platformsChart');
      if (platformsCanvas) {
        const platformsCtx = platformsCanvas.getContext('2d');

        if (this.charts.platforms) {
          this.charts.platforms.destroy();
        }

        const colors = [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)'
        ];

        this.charts.platforms = new Chart(platformsCtx, {
          type: 'pie',
          data: {
            labels: ['PC', 'Mobile'],
            datasets: [{
              label: 'Dispositivos',
              data: [deviceTypes.PC, deviceTypes.Mobile],
              backgroundColor: colors,
              borderColor: 'rgba(15, 23, 42, 0.8)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: 'bottom',
                labels: {
                  color: '#e2e8f0',
                  font: {
                    family: 'Inter',
                    size: 12
                  },
                  padding: 15
                }
              },
              title: {
                display: true,
                text: 'PC vs Mobile',
                color: '#e2e8f0',
                font: {
                  family: 'Inter',
                  size: 16,
                  weight: 'bold'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(100, 116, 139, 0.3)',
                borderWidth: 1,
                padding: 12,
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }

      this.addActivity('Analytics carregado com sucesso');
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
      const canvas = document.getElementById('itemsChart');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Erro ao carregar analytics', canvas.width / 2, canvas.height / 2);
      }
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => adminApp.init());
} else {
  adminApp.init();
}
