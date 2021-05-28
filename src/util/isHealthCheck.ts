export const HEALTHY_RESPONSE = {
  body: 'HEALTHY',
  statusCode: 200,
};

export function isHealthCheck(event: any): boolean {
  return event.httpMethod === 'GET' && event.path === '/private/health-check';
}
