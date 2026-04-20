import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, orderBy, limit, writeBatch, setLogLevel } from 'firebase/firestore';

// Set log level to reduce noise from internal SDK warnings
setLogLevel('error');

// Load Firebase configuration
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};

if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  } catch (e) {
    console.error("Error parsing firebase-applet-config.json:", e);
  }
}

import { WATER_HISTORY } from './src/services/waterHistoryData';

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log(`[SERVER] Firebase Client SDK initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId}`);

const DATA_FILE = path.join(process.cwd(), "data.json");

const DEFAULT_USERS = [
  { id: 'master-1', name: 'Master Admin', username: 'master@picks.pro', password: '123', role: 'MASTER', status: 'approved', assignedBuildings: [], assignedUnits: ['USAC', 'CG', 'GCG', 'GOE3', 'GOE4', 'BOEL', 'UMOE', 'CECOM'] },
  { id: 'master-jyebavi', name: 'Jyebavi', username: 'jyebavi', password: '123', role: 'MASTER', status: 'approved', assignedBuildings: [], assignedUnits: ['USAC', 'CG', 'GCG', 'GOE3', 'GOE4', 'BOEL', 'UMOE', 'CECOM'] }
];

// Helper to read/write data
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      users: DEFAULT_USERS,
      readings: [],
      requests: [],
      tasks: [],
      notifications: [],
      waterAccounts: [],
      gasoilTanks: [],
      boilers: []
    };
  }
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!data.users || data.users.length === 0) {
      data.users = DEFAULT_USERS;
    }
    return data;
  } catch (e) {
    return {
      users: DEFAULT_USERS,
      readings: [],
      requests: [],
      tasks: [],
      notifications: [],
      waterAccounts: [],
      gasoilTanks: [],
      boilers: []
    };
  }
};

const writeData = (data: any) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// --- WATER AUTOMATION ---

async function importHistoricalData() {
  try {
    const readingsRef = collection(db, 'readings');
    const q = query(readingsRef, 
      where('serviceType', '==', 'agua'),
      where('buildingId', '==', 'BASE_ALICANTE'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log("Importing historical water data...");
      const batch = writeBatch(db);
      for (const entry of WATER_HISTORY) {
        const readingId = `water-hist-${entry.date}`;
        const docRef = doc(readingsRef, readingId);
        batch.set(docRef, {
          id: readingId,
          buildingId: 'BASE_ALICANTE',
          date: `${entry.date}T00:00:00Z`,
          timestamp: `${entry.date}T00:00:00Z`,
          userId: 'system-import',
          serviceType: 'agua',
          origin: 'telematica',
          value1: entry.value,
          consumption1: entry.consumption,
          isPeak: entry.consumption > 150
        });
      }
      await batch.commit();
      console.log("Historical data imported successfully.");
    }

    // Ensure a default water account exists
    const accountsRef = collection(db, 'water_accounts');
    const accountsSnapshot = await getDocs(query(accountsRef, limit(1)));
    if (accountsSnapshot.empty) {
      console.log("Creating default water account...");
      await setDoc(doc(accountsRef, 'main-water-account'), {
        id: 'main-water-account',
        name: 'Contador General Base Alicante',
        buildingId: 'BASE_ALICANTE',
        webUser: 'USAC_ALICANTE',
        status: 'conectada',
        peakThresholdM3: 150,
        peakThresholdPercent: 50,
        selectors: {
          userField: '#username',
          passwordField: '#password',
          submitBtn: '#login-btn',
          tableRow: '.consumption-row'
        }
      });
    }

    // Seed Boilers if empty
    const boilersRef = collection(db, 'boilers');
    const boilersSnapshot = await getDocs(query(boilersRef, limit(1)));
    if (boilersSnapshot.empty) {
      console.log("Seeding default boilers...");
      const defaultBoilers = [
        {
          id: 'E0007',
          buildingId: 'E0007',
          buildingCode: 'E0007',
          buildingName: 'Vestuario de Mandos',
          code: 'CAL-0007',
          brand: 'Roca',
          model: 'P-30',
          powerKw: 45,
          status: 'operativa',
          refTemps: { impulsionMin: 60, impulsionMax: 85, pressureMin: 1.2, pressureMax: 2.5 }
        },
        {
          id: 'E0010',
          buildingId: 'E0010',
          buildingCode: 'E0010',
          buildingName: 'Vestuario GCG y GOE III',
          code: 'CAL-0010',
          brand: 'Ferroli',
          model: 'SFL 3',
          powerKw: 60,
          status: 'operativa',
          refTemps: { impulsionMin: 60, impulsionMax: 80, pressureMin: 1.5, pressureMax: 2.8 }
        }
      ];
      for (const b of defaultBoilers) {
        await setDoc(doc(boilersRef, b.id), b);
      }
    }

    // Seed Gasoil Tanks if empty
    const tanksRef = collection(db, 'gasoil_tanks');
    const tanksSnapshot = await getDocs(query(tanksRef, limit(1)));
    if (tanksSnapshot.empty) {
      console.log("Seeding default gasoil tanks...");
      const defaultTanks = [
        {
          id: 'tank-1',
          buildingId: 'E0007',
          buildingCode: 'E0007',
          buildingName: 'Vestuario de Mandos',
          tankNumber: 1,
          fullName: 'Depósito Vestuario Mandos',
          totalCapacity: 2000,
          currentLevel: 75,
          currentLitres: 1500,
          alertStatus: 'normal'
        }
      ];
      for (const t of defaultTanks) {
        await setDoc(doc(tanksRef, t.id), t);
      }
    }
    
    // Seed Salt Stock if empty
    const saltRef = doc(db, 'salt_stock', 'current');
    const saltDoc = await getDoc(saltRef);
    if (!saltDoc.exists()) {
      console.log("Seeding default salt stock...");
      await setDoc(saltRef, {
        sacksAvailable: 45,
        kgPerSack: 25,
        minAlertLevel: 20,
        criticalAlertLevel: 10,
        status: 'normal',
        lastSupplier: 'Salinas de Torrevieja'
      });
    }

    // Seed Providers if empty
    const providersRef = collection(db, 'providers');
    const providersSnapshot = await getDocs(query(providersRef, limit(1)));
    if (providersSnapshot.empty) {
      console.log("Seeding default providers...");
      const defaultProviders = [
        {
          id: 'prov-1',
          name: 'Suministros Industriales Levante',
          cif: 'A03123456',
          phone: '965123456',
          email: 'ventas@suministroslevante.com',
          categories: ['ferreteria', 'fontaneria'],
          address: 'Polígono Industrial Las Atalayas, Alicante'
        },
        {
          id: 'prov-2',
          name: 'Electricidad Rabasa',
          cif: 'B03987654',
          phone: '965987654',
          email: 'info@electricidadrabasa.es',
          categories: ['electricidad'],
          address: 'Calle Mayor 45, San Vicente del Raspeig'
        }
      ];
      for (const p of defaultProviders) {
        await setDoc(doc(providersRef, p.id), p);
      }
    }

    // Seed Categories if empty
    const categoriesRef = collection(db, 'categories');
    const categoriesSnapshot = await getDocs(query(categoriesRef, limit(1)));
    if (categoriesSnapshot.empty) {
      console.log("Seeding default categories...");
      const defaultCategories = [
        { id: 'ferreteria', name: 'Ferretería', icon: 'Hammer' },
        { id: 'fontaneria', name: 'Fontanería', icon: 'Droplets' },
        { id: 'electricidad', name: 'Electricidad', icon: 'Zap' },
        { id: 'climatizacion', name: 'Climatización', icon: 'Thermometer' },
        { id: 'pintura', name: 'Pintura', icon: 'Paintbrush' },
        { id: 'limpieza', name: 'Limpieza', icon: 'Trash2' },
        { id: 'jardineria', name: 'Jardinería', icon: 'Leaf' },
        { id: 'oficina', name: 'Oficina', icon: 'Briefcase' },
        { id: 'seguridad', name: 'Seguridad', icon: 'Shield' },
        { id: 'construccion', name: 'Construcción', icon: 'HardHat' },
        { id: 'carpinteria', name: 'Carpintería', icon: 'Box' },
        { id: 'informatica', name: 'Informática', icon: 'Monitor' },
        { id: 'otros', name: 'Otros', icon: 'MoreHorizontal' }
      ];
      for (const c of defaultCategories) {
        await setDoc(doc(categoriesRef, c.id), c);
      }
    }
  } catch (error) {
    console.error("Error importing historical data:", error);
  }
}

async function automateWaterSync() {
  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Run once a day at 00:00
    if (hours === 0 && minutes < 5) {
      console.log("Starting automated water sync at 00:00...");
      
      const readingsRef = collection(db, 'readings');
      const q = query(readingsRef, 
        where('serviceType', '==', 'agua'),
        where('buildingId', '==', 'BASE_ALICANTE'),
        orderBy('date', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const lastReading = snapshot.docs[0].data();
        const lastDate = new Date(lastReading.date);
        const todayStr = now.toISOString().split('T')[0];
        const lastDateStr = lastDate.toISOString().split('T')[0];

        if (todayStr !== lastDateStr) {
          const avgConsumption = 60;
          const variation = Math.random() * 40 - 20;
          const consumption = Math.max(10, avgConsumption + variation);
          const newValue = lastReading.value1 + consumption;

          const readingId = `water-auto-${todayStr}`;
          const newReading = {
            id: readingId,
            buildingId: 'BASE_ALICANTE',
            date: now.toISOString(),
            timestamp: now.toISOString(),
            userId: 'system-auto',
            serviceType: 'agua',
            origin: 'telematica',
            value1: Number(newValue.toFixed(2)),
            consumption1: Number(consumption.toFixed(2)),
            isPeak: consumption > 150
          };

          await setDoc(doc(readingsRef, readingId), newReading);
          console.log(`Automated water reading saved: ${newValue} m3 (+${consumption})`);

          if (consumption > 150) {
            await addDoc(collection(db, 'notifications'), {
              id: crypto.randomUUID(),
              userId: 'all',
              title: 'ALERTA: Consumo de Agua Elevado',
              message: `Se ha detectado un consumo inusual de ${consumption.toFixed(2)} m³ en BASE ALICANTE.`,
              type: 'alert',
              date: now.toISOString(),
              read: false
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in automated water sync:", error);
  }
}

async function automateGasoilTelemetry() {
  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Simulate sensor update every 4 hours
    if (hours % 4 === 0 && minutes < 5) {
      console.log("Updating Gasoil telemetry sensors...");
      const tanksRef = collection(db, 'gasoil_tanks');
      const snapshot = await getDocs(tanksRef);

      for (const docSnapshot of snapshot.docs) {
        const tank = docSnapshot.data();
        // Simulate a small daily consumption (0.1% to 0.5% every 4 hours)
        const consumptionPercent = (Math.random() * 0.4 + 0.1);
        const newLevel = Math.max(0, tank.currentLevel - consumptionPercent);
        const newLitres = (newLevel / 100) * tank.totalCapacity;

        let alertStatus = 'normal';
        if (newLevel < 15) alertStatus = 'critico';
        else if (newLevel < 25) alertStatus = 'bajo';
        else if (newLevel < 40) alertStatus = 'atencion';

        await updateDoc(docSnapshot.ref, {
          currentLevel: Number(newLevel.toFixed(2)),
          currentLitres: Math.round(newLitres),
          lastReading: now.toISOString(),
          alertStatus
        });

        // Add to readings history
        await addDoc(collection(db, 'gasoil_readings'), {
          id: crypto.randomUUID(),
          tankId: docSnapshot.id,
          date: now.toISOString(),
          percentage: Number(newLevel.toFixed(2)),
          litres: Math.round(newLitres),
          method: 'sensor',
          userId: 'system-iot'
        });

        if (alertStatus === 'critico' || alertStatus === 'bajo') {
          await addDoc(collection(db, 'notifications'), {
            id: crypto.randomUUID(),
            userId: 'all',
            title: `Nivel Bajo: ${tank.fullName}`,
            message: `El depósito ${tank.fullName} está al ${newLevel.toFixed(1)}%. Se recomienda repostaje.`,
            type: 'alert',
            date: now.toISOString(),
            read: false
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in Gasoil telemetry:", error);
  }
}

async function automateBoilerTelemetry() {
  try {
    const now = new Date();
    const minutes = now.getMinutes();

    // Update every 30 minutes
    if (minutes % 30 < 5) {
      console.log("Updating Boiler IoT sensors...");
      const boilersRef = collection(db, 'boilers');
      
      let snapshot;
      try {
        snapshot = await getDocs(boilersRef);
      } catch (e: any) {
        console.error("Error fetching boilers for telemetry:", e.message);
        return;
      }

      for (const docSnapshot of snapshot.docs) {
        const boiler = docSnapshot.data();
        if (boiler.status === 'averiada' || boiler.status === 'fuera_servicio') continue;

        // Simulate normal operating ranges
        const tempImpulsion = boiler.refTemps.impulsionMin + Math.random() * (boiler.refTemps.impulsionMax - boiler.refTemps.impulsionMin);
        const tempRetorno = tempImpulsion - (5 + Math.random() * 10);
        const pressure = boiler.refTemps.pressureMin + Math.random() * (boiler.refTemps.pressureMax - boiler.refTemps.pressureMin);
        
        const alerts = [];
        if (pressure > boiler.refTemps.pressureMax) alerts.push('SOBREPRESIÓN');
        if (pressure < boiler.refTemps.pressureMin) alerts.push('BAJA PRESIÓN');

        await addDoc(collection(db, 'boiler_readings'), {
          id: crypto.randomUUID(),
          boilerId: docSnapshot.id,
          date: now.toISOString(),
          tempImpulsion: Number(tempImpulsion.toFixed(1)),
          tempRetorno: Number(tempRetorno.toFixed(1)),
          pressure: Number(pressure.toFixed(2)),
          isOn: true,
          userId: 'system-iot',
          userName: 'Sensor IoT Central',
          alerts
        });

        if (alerts.length > 0) {
          await addDoc(collection(db, 'notifications'), {
            id: crypto.randomUUID(),
            userId: 'all',
            title: `Alarma Caldera: ${boiler.code}`,
            message: `Detectada anomalía en ${boiler.buildingName}: ${alerts.join(', ')}`,
            type: 'alert',
            date: now.toISOString(),
            read: false
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in Boiler telemetry:", error);
  }
}

async function automateSaltInventory() {
  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Run once a day at 01:00
    if (hours === 1 && minutes < 5) {
      console.log("Updating Salt inventory levels...");
      const stockRef = doc(db, 'salt_stock', 'current');
      const docSnapshot = await getDoc(stockRef);
      
      if (docSnapshot.exists()) {
        const stock = docSnapshot.data();
        // Simulate consumption: 0.5 to 1.5 sacks per day
        const consumption = 0.5 + Math.random();
        const newSacks = Math.max(0, stock.sacksAvailable - consumption);
        
        let status = 'normal';
        if (newSacks < stock.criticalAlertLevel) status = 'critico';
        else if (newSacks < stock.minAlertLevel) status = 'bajo';

        await updateDoc(stockRef, {
          sacksAvailable: Number(newSacks.toFixed(1)),
          status
        });

        if (status === 'critico' || status === 'bajo') {
          await addDoc(collection(db, 'notifications'), {
            id: crypto.randomUUID(),
            userId: 'all',
            title: 'Stock de Sal Bajo',
            message: `Quedan aproximadamente ${newSacks.toFixed(1)} sacos en el almacén central.`,
            type: 'alert',
            date: now.toISOString(),
            read: false
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in Salt inventory automation:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/data", (req, res) => {
    res.json(readData());
  });

  app.post("/api/save", (req, res) => {
    const newData = req.body;
    writeData(newData);
    res.json({ status: "ok" });
  });

  // Specific endpoints for easier management if needed
  app.get("/api/users", (req, res) => {
    res.json(readData().users);
  });

  app.post("/api/users", (req, res) => {
    const data = readData();
    const newUser = req.body;
    const index = data.users.findIndex((u: any) => u.id === newUser.id);
    if (index > -1) {
      data.users[index] = newUser;
    } else {
      data.users.push(newUser);
    }
    writeData(data);
    res.json(newUser);
  });

  // Vite middleware for development or fallback
  const isProduction = process.env.NODE_ENV === "production";
  const distExists = fs.existsSync(path.join(process.cwd(), "dist"));

  if (isProduction && distExists) {
    console.log("[SERVER] Serving production build from dist/");
    app.use(express.static("dist"));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  } else {
    console.log("[SERVER] Starting in development mode with Vite middleware...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite middleware initialized successfully");
    } catch (e) {
      console.error("Failed to start Vite middleware. If this is production, ensure 'npm run build' was executed.", e);
      app.get("*all", (req, res) => {
        res.status(500).send("Server configuration error: dist/ not found and Vite not available.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initial import
    importHistoricalData();

    // Start automation interval (every 5 minutes to check for scheduled tasks)
    setInterval(() => {
      automateWaterSync();
      automateGasoilTelemetry();
      automateBoilerTelemetry();
      automateSaltInventory();
    }, 5 * 60 * 1000);
  });
}

startServer();
