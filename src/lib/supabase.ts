import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InfoItem, SupabaseConfig } from '../types';


const CONFIG_STORAGE_KEY = 'hansearch_supabase_config';

export const DEFAULT_SUPABASE_URL = 'https://trtpgahsnuddenmxuazq.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_N_NBrRMNfUDwfCodR-nZ6g_KCFEZiw1';
export const DEFAULT_TABLE_NAME = 'info';
export const DEFAULT_STORAGE_BUCKET = 'hansearch-images';

export function getDefaultConfig(): SupabaseConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const envTable = import.meta.env.VITE_SUPABASE_TABLE || DEFAULT_TABLE_NAME;
  const envBucket = import.meta.env.VITE_SUPABASE_BUCKET || DEFAULT_STORAGE_BUCKET;

  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const url = parsed.url && parsed.url.trim() ? parsed.url.trim() : envUrl;
      const anonKey = parsed.anonKey && parsed.anonKey.trim() ? parsed.anonKey.trim() : envKey;
      return {
        url,
        anonKey,
        tableName: parsed.tableName || envTable,
        storageBucket: parsed.storageBucket || envBucket,
      };
    }
  } catch (e) {
    console.error('Failed to parse saved config', e);
  }

  return {
    url: envUrl,
    anonKey: envKey,
    tableName: envTable,
    storageBucket: envBucket,
  };
}



export function saveConfig(config: SupabaseConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    clientInstance = null; // Reset client instance to reload with new config
  } catch (e) {
    console.error('Failed to save supabase config', e);
  }
}

let clientInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabaseClient(overrideConfig?: SupabaseConfig): SupabaseClient | null {
  const config = overrideConfig || getDefaultConfig();
  const configKey = `${config.url}_${config.anonKey}`;

  if (!config.url || !config.anonKey) {
    return null;
  }

  if (clientInstance && currentConfigKey === configKey) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(config.url, config.anonKey);
    currentConfigKey = configKey;
    return clientInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test Supabase connection and table accessibility
 */
export async function testConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (!config.url || !config.anonKey) {
      return { success: false, message: 'URL과 Anon Key를 모두 입력해주세요.' };
    }

    const testClient = createClient(config.url, config.anonKey);
    const { count, error } = await testClient
      .from(config.tableName || 'info')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { success: false, message: `연결 오류: ${error.message}` };
    }

    return { 
      success: true, 
      message: `성공적으로 연결되었습니다! (총 ${count ?? 0}개의 데이터 확인됨)`,
      count: count ?? 0
    };
  } catch (err: any) {
    return { success: false, message: `연결 실패: ${err?.message || '알 수 없는 오류'}` };
  }
}

/**
 * Fetch all items from the table
 */
export async function fetchAllItems(config?: SupabaseConfig): Promise<InfoItem[]> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase 설정이 필요합니다. 상단 설정 아이콘을 눌러 URL과 Key를 입력해주세요.');
  }

  const { data, error } = await client
    .from(targetConfig.tableName || 'info')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as InfoItem[];
}

/**
 * Insert a new item
 */
export async function insertItem(item: Omit<InfoItem, 'id' | 'created_at'>, config?: SupabaseConfig): Promise<InfoItem> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await client
    .from(targetConfig.tableName || 'info')
    .insert([
      {
        키워드: item.키워드 || '공통',
        키워드2: item.키워드2 || '',
        내용: item.내용 || '',
        이미지들: item.이미지들 || null,
      }
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as InfoItem;
}

/**
 * Bulk Insert multiple items (e.g. from Excel)
 */
export async function bulkInsertItems(items: Array<Omit<InfoItem, 'id' | 'created_at'>>, config?: SupabaseConfig): Promise<number> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const payload = items.map(item => ({
    키워드: item.키워드 || '공통',
    키워드2: item.키워드2 || '',
    내용: item.내용 || '',
    이미지들: item.이미지들 || null,
  }));

  const { data, error } = await client
    .from(targetConfig.tableName || 'info')
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  return data?.length || 0;
}

/**
 * Update an existing item
 */
export async function updateItem(id: number, item: Partial<InfoItem>, config?: SupabaseConfig): Promise<InfoItem> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const payload: any = {};
  if (item.키워드 !== undefined) payload.키워드 = item.키워드;
  if (item.키워드2 !== undefined) payload.키워드2 = item.키워드2;
  if (item.내용 !== undefined) payload.내용 = item.내용;
  if (item.이미지들 !== undefined) payload.이미지들 = item.이미지들;

  const { data, error } = await client
    .from(targetConfig.tableName || 'info')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as InfoItem;
}

/**
 * Delete an item
 */
export async function deleteItem(id: number, config?: SupabaseConfig): Promise<void> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await client
    .from(targetConfig.tableName || 'info')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * Bulk delete items by ids
 */
export async function bulkDeleteItems(ids: number[], config?: SupabaseConfig): Promise<number> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await client
    .from(targetConfig.tableName || 'info')
    .delete()
    .in('id', ids)
    .select();

  if (error) {
    throw error;
  }

  return data?.length || 0;
}

/**
 * Upload image to Supabase Storage and get public URL
 */
export async function uploadImageToStorage(file: File, config?: SupabaseConfig): Promise<string> {
  const client = getSupabaseClient(config);
  const targetConfig = config || getDefaultConfig();

  if (!client) {
    throw new Error('Supabase client not initialized');
  }

  const bucketName = targetConfig.storageBucket || 'images';
  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await client.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message} (버킷 '${bucketName}' 존재 및 Public 정책 확인 필요)`);
  }

  const { data: publicUrlData } = client.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
