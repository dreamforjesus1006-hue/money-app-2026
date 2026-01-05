// ↓↓↓ 修正：改成 ./types (同層目錄) ↓↓↓
import { AppState, CloudConfig } from './types';
// ↑↑↑ 修正結束 ↑↑↑
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'bao_zu_tang_data_v1';
const CLOUD_CONFIG_KEY = 'bao_zu_tang_cloud_config_v1';

export class StorageService {
  private static db: any = null;

  static saveToLocal(state: AppState): void {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  }

  static loadFromLocal(): AppState | null {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return null;
      return JSON.parse(json) as AppState;
    } catch (e) {
      console.error('Failed to load from local storage', e);
      return null;
    }
  }

  static getStorageUsage(): { used: number; total: number } {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      const usedBytes = json ? new Blob([json]).size : 0;
      const totalBytes = 5 * 1024 * 1024; 
      return { used: usedBytes, total: totalBytes };
    } catch (e) {
      return { used: 0, total: 5 * 1024 * 1024 };
    }
  }

  static clearLocal(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // --- Cloud Configuration Management ---
  static saveCloudConfig(config: CloudConfig): void {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  }

  static loadCloudConfig(): CloudConfig | null {
    const json = localStorage.getItem(CLOUD_CONFIG_KEY);
    return json ? JSON.parse(json) : null;
  }

  // --- Firebase Integration ---
  private static getFirebaseDb(config: CloudConfig) {
    if (this.db) return this.db;

    const firebaseConfig = {
      apiKey: config.apiKey,
      projectId: config.projectId,
      authDomain: `${config.projectId}.firebaseapp.com`,
    };

    try {
      // Initialize or get existing app
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      this.db = getFirestore(app);
      return this.db;
    } catch (error: any) {
      console.error("Firebase init error:", error);
      alert(`Firebase 初始化失敗: ${error.message}\n請檢查 API Key 是否正確。`);
      throw error;
    }
  }

  static async saveToCloud(state: AppState, config: CloudConfig): Promise<void> {
    if (!config.enabled || !config.apiKey || !config.projectId || !config.syncId) {
       throw new Error("Cloud config incomplete");
    }

    try {
      const db = this.getFirebaseDb(config);
      // Save to collection 'portfolios', document ID = syncId
      await setDoc(doc(db, "portfolios", config.syncId), state);
      console.log("Saved to cloud successfully");
    } catch (e: any) {
      console.error("Firebase save error", e);
      // Explicitly alert the user for common errors
      if (e.code === 'permission-denied') {
          alert(`雲端儲存失敗：權限被拒絕 (Permission Denied)\n\n請回到 Firebase Console -> Firestore Database -> Rules\n將規則改為 allow read, write: if true;`);
      } else {
          alert(`雲端儲存失敗：${e.message}`);
      }
      throw e;
    }
  }

  static async loadFromCloud(config: CloudConfig): Promise<AppState | null> {
    if (!config.enabled || !config.apiKey || !config.projectId || !config.syncId) {
      return null;
    }

    try {
      const db = this.getFirebaseDb(config);
      const docRef = doc(db, "portfolios", config.syncId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("Loaded from cloud successfully");
        return docSnap.data() as AppState;
      } else {
        console.log("No such document in cloud");
        return null;
      }
    } catch (e: any) {
      console.error("Firebase load error", e);
      if (e.code === 'permission-denied') {
          alert(`雲端讀取失敗：權限被拒絕 (Permission Denied)\n\n請務必到 Firebase 後台開啟 Firestore Database 並設定規則。`);
      }
      throw e; // Propagate error so UI knows
    }
  }

  // --- Unified Save/Load ---

  static async saveData(state: AppState): Promise<void> {
    // 1. Always save local backup immediately
    this.saveToLocal(state);

    // 2. Try Cloud if configured
    const cloudConfig = this.loadCloudConfig();
    if (cloudConfig && cloudConfig.enabled) {
      await this.saveToCloud(state, cloudConfig);
    }
  }

  static async loadData(): Promise<{ data: AppState | null, source: 'cloud' | 'local' | 'gas' }> {
    // 1. Try Cloud
    const cloudConfig = this.loadCloudConfig();
    if (cloudConfig && cloudConfig.enabled) {
      try {
        const cloudData = await this.loadFromCloud(cloudConfig);
        if (cloudData) return { data: cloudData, source: 'cloud' };
      } catch (e) {
        console.warn("Cloud load failed, falling back", e);
        // Fallthrough to local
      }
    }

    // 2. Local
    return { data: this.loadFromLocal(), source: 'local' };
  }

  static exportToFile(state: AppState): void {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    const date = new Date().toISOString().split('T')[0];
    link.download = `bao_zu_tang_config_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }
}
