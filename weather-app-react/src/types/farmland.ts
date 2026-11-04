/** 地块列表/详情共用的数据形状 */
export interface Farmland {
  id: number;
  fieldName: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  areaMu: number | null;
  soilType: string | null;
  irrigationType: string | null;
  cropId: number | null;
  plantDate: string | null;
  boundary?: string | null;
  agentId?: number | null;
  agentName?: string | null;
}

export type FarmlandAction = 'weather' | 'alerts' | 'advice';
