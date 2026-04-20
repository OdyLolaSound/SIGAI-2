
// test/analizarAguasAlicante.js
// SCRIPT DE UTILIDAD PARA EQUIPO TÉCNICO USAC - NO EJECUTABLE EN NAVEGADOR
// Requiere: npm install puppeteer

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const CREDENCIALES = {
  usuario: 'S0300017A',
  password: 'Usac15.'
};

class AnalizadorAguasAlicante {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshotsDir = path.join(__dirname, 'analisis_screenshots');
    this.reportPath = path.join(__dirname, 'analisis_reporte.json');
  }
  
  async log(mensaje, tipo = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${tipo}] ${mensaje}`);
  }
  
  async iniciar() {
    await this.log('🚀 Iniciando análisis de Aguas de Alicante...');
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    
    this.browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      defaultViewport: null
    });
    this.page = await this.browser.newPage();
  }
  
  async capturar(nombre) {
    const filename = `${Date.now()}_${nombre}.png`;
    const filepath = path.join(this.screenshotsDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }
  
  async analizar() {
    const reporte = { timestamp: new Date().toISOString(), etapas: {}, errores: [] };
    try {
      await this.log('🔍 ETAPA 1: Buscando página de login...');
      await this.page.goto('https://www.aguasdealicante.es/acceso-area-privada', { waitUntil: 'networkidle2' });
      await this.capturar('01_login_page');

      const selectores = await this.page.evaluate(() => {
        const resultado = { userField: null, passField: null, submitBtn: null };
        const posiblesUsuario = ['input[name*="user" i]', 'input[id*="user" i]', 'input[type="text"]'];
        for (const s of posiblesUsuario) {
          if (document.querySelector(s)) { resultado.userField = s; break; }
        }
        resultado.passField = 'input[type="password"]';
        resultado.submitBtn = 'button[type="submit"], input[type="submit"]';
        return resultado;
      });

      reporte.etapas.identificacion = selectores;
      await this.log(`✅ Selectores: ${JSON.stringify(selectores)}`);

    } catch (error) {
      await this.log(`❌ Error: ${error.message}`, 'ERROR');
      reporte.errores.push(error.message);
    }
    await fs.writeFile(this.reportPath, JSON.stringify(reporte, null, 2));
    return reporte;
  }
}

// Ejecución manual: node analizarAguasAlicante.js
