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
      iframe.src = iframe.src;
    });

    document.getElementById('openPreview')?.addEventListener('click', () => {
      window.open('index.html', '_blank');
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
      this.saveAllSettings();
    });

    document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => {
      const iframe = document.getElementById('settingsPreviewFrame');
      if (iframe) {
        iframe.src = iframe.src;
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
      if (iframe && iframe.src !== window.location.origin + '/index.html') {
        iframe.src = 'index.html';
      }
    } else if (section === 'analytics') {
      this.loadAnalytics();
    } else if (section === 'devices') {
      this.loadDevices();
    } else if (section === 'settings') {
      this.loadRouletteConfig();
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

  async saveAllSettings() {
    if (!this.firebaseInitialized || !this.db) {
      alert('Firebase não configurado. Configure o Firebase para salvar as configurações.');
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      const currentLayout = snapshot.exists() ? snapshot.val() : {};

      currentLayout.backgroundColor = document.getElementById('backgroundColor').value;
      currentLayout.backgroundColorSecondary = document.getElementById('backgroundColorSecondary').value;
      currentLayout.buttonColor = document.getElementById('buttonColor').value;
      currentLayout.buttonHoverColor = document.getElementById('buttonHoverColor').value;
      currentLayout.accentColor = document.getElementById('accentColor').value;

      currentLayout.heroTitle = document.getElementById('heroTitle').value;
      currentLayout.heroSubtitle = document.getElementById('heroSubtitle').value;
      currentLayout.heroTitleSize = parseInt(document.getElementById('heroTitleSize').value);
      currentLayout.heroSubtitleSize = parseInt(document.getElementById('heroSubtitleSize').value);
      currentLayout.heroTitleColor = document.getElementById('heroTitleColor').value;
      currentLayout.heroSubtitleColor = document.getElementById('heroSubtitleColor').value;

      currentLayout.roulette = {
        design: document.getElementById('rouletteDesign').value,
        animation: document.getElementById('rouletteAnimation').value === 'none' ? null : document.getElementById('rouletteAnimation').value,
        boxSize: parseInt(document.getElementById('rouletteBoxSize').value),
        containerWidth: document.getElementById('rouletteContainerWidth').value,
        gap: parseInt(document.getElementById('rouletteGap').value),
        enableDragDrop: document.getElementById('enableDragDrop').checked
      };

      currentLayout.backgroundAnimation = {
        type: document.getElementById('backgroundAnimation').value,
        speed: parseInt(document.getElementById('animationSpeed').value),
        opacity: parseInt(document.getElementById('animationOpacity').value)
      };

      currentLayout.spin = {
        duration: parseInt(document.getElementById('spinDuration').value),
        speed: parseInt(document.getElementById('spinSpeed').value),
        deceleration: document.getElementById('spinDeceleration').checked
      };

      currentLayout.spacing = {
        containerPadding: parseInt(document.getElementById('containerPadding').value),
        heroMarginTop: parseInt(document.getElementById('heroMarginTop').value),
        heroMarginBottom: parseInt(document.getElementById('heroMarginBottom').value)
      };

      currentLayout.lastUpdate = firebase.database.ServerValue.TIMESTAMP;

      await layoutRef.set(currentLayout);
      this.addActivity('Todas as configurações salvas com sucesso');
      alert('Todas as configurações foram salvas! As mudanças serão aplicadas no site em tempo real.');

      const iframe = document.getElementById('settingsPreviewFrame');
      if (iframe) {
        setTimeout(() => {
          iframe.src = iframe.src;
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações');
    }
  },

  async loadRouletteConfig() {
    if (!this.firebaseInitialized || !this.db) {
      return;
    }

    try {
      const layoutRef = this.db.ref('settings/layout');
      const snapshot = await layoutRef.once('value');
      
      if (snapshot.exists()) {
        const layout = snapshot.val();
        
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
          document.getElementById('heroTitleSize').value = layout.heroTitleSize;
        }
        if (layout.heroSubtitleSize) {
          document.getElementById('heroSubtitleSize').value = layout.heroSubtitleSize;
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
            document.getElementById('rouletteBoxSize').value = config.boxSize;
          }
          
          if (config.containerWidth) {
            document.getElementById('rouletteContainerWidth').value = config.containerWidth;
          }

          if (config.gap !== undefined) {
            document.getElementById('rouletteGap').value = config.gap;
          }
          
          if (config.enableDragDrop !== undefined) {
            document.getElementById('enableDragDrop').checked = config.enableDragDrop;
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

        if (layout.spin) {
          if (layout.spin.duration) {
            const spinDurationEl = document.getElementById('spinDuration');
            if (spinDurationEl) spinDurationEl.value = layout.spin.duration;
          }
          if (layout.spin.speed) {
            const spinSpeedEl = document.getElementById('spinSpeed');
            const spinSpeedValueEl = document.getElementById('spinSpeedValue');
            if (spinSpeedEl) spinSpeedEl.value = layout.spin.speed;
            if (spinSpeedValueEl) spinSpeedValueEl.textContent = layout.spin.speed + 'ms';
          }
          if (layout.spin.deceleration !== undefined) {
            const spinDecelerationEl = document.getElementById('spinDeceleration');
            if (spinDecelerationEl) spinDecelerationEl.checked = layout.spin.deceleration;
          }
        }

        if (layout.spacing) {
          if (layout.spacing.containerPadding !== undefined) {
            document.getElementById('containerPadding').value = layout.spacing.containerPadding;
          }
          if (layout.spacing.heroMarginTop !== undefined) {
            document.getElementById('heroMarginTop').value = layout.spacing.heroMarginTop;
          }
          if (layout.spacing.heroMarginBottom !== undefined) {
            document.getElementById('heroMarginBottom').value = layout.spacing.heroMarginBottom;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  },

  async loadSettings() {
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    
    if (settings.autoSave !== undefined) {
      const autoSave = document.getElementById('autoSave');
      if (autoSave) autoSave.checked = settings.autoSave;
    }
    if (settings.spinDuration) {
      const spinDuration = document.getElementById('spinDuration');
      if (spinDuration) spinDuration.value = settings.spinDuration;
    }
    
    await this.loadRouletteConfig();
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
