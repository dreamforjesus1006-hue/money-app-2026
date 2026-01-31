const STORAGE_KEY = 'baozutang_data_v14_clean';
const CLOUD_CONFIG_KEY = 'baozutang_cloud_config';

export const StorageService = {
    saveData: async (data: any) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("Save failed", e);
            return false;
        }
    },
    loadData: async () => {
        try {
            const local = localStorage.getItem(STORAGE_KEY);
            return { data: local ? JSON.parse(local) : null, source: 'local' };
        } catch (e) {
            console.error("Load failed", e);
            return { data: null, source: 'local' };
        }
    },
    saveCloudConfig: (config: any) => {
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
    },
    loadCloudConfig: () => {
        const c = localStorage.getItem(CLOUD_CONFIG_KEY);
        return c ? JSON.parse(c) : null;
    },
    exportToFile: (data: any) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `baozutang_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }
};
