import { helper } from '@/utils/helper';

export const greeting = 'Hello from complex transformations fixture!';

export function processData(data: string[]): string {
  return data.map((item) => helper(item)).join(', ');
}

export default greeting;
