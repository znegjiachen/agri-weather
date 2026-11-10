/** 省 / 市 / 区县行政区划选项，带中心点坐标（GCJ-02）。 */
export interface RegionOption {
  name: string;
  adcode: number;
  center: [number, number];
  level: string;
}

export const REGION_ROOT_URL =
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

export const regionUrl = (adcode: number) =>
  `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`;

export async function fetchRegionOptions(url: string): Promise<RegionOption[]> {
  // 阿里云 DataV 对部分 IP/域名 Referer 返回 403；行政区划是公开数据，去掉 Referer 再取
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error('行政区划数据加载失败');
  const data = await response.json();
  return (data.features || [])
    .map((feature: any) => {
      const props = feature.properties || {};
      const center = props.center;
      if (!Array.isArray(center) || center.length < 2) return null;
      return {
        name: props.name,
        adcode: Number(props.adcode),
        center: [Number(center[0]), Number(center[1])] as [number, number],
        level: props.level || '',
      };
    })
    .filter(Boolean) as RegionOption[];
}
